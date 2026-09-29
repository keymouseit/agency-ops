import { prisma } from "@/lib/prisma";

// Dynamic model accessor ensuring live PrismaClient instance
const getDeviceTokenModel = () => (prisma as any).deviceToken;
import { logger } from "@/lib/logger";
import { google } from "googleapis";
import path from "path";
import fs from "fs";

/**
 * Send push notification directly to native Android device via Firebase Cloud Messaging HTTP v1 API
 */
async function sendFcmNotification(token: string, title: string, body: string, data: Record<string, any> = {}) {
  try {
    let auth: any = null;
    let projectId = "agency-ops-cb73e";

    const envJson = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
    const envBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
    const serviceAccountPath = path.join(process.cwd(), "service-account.json");

    if (envJson) {
      const credentials = JSON.parse(envJson);
      projectId = credentials.project_id || projectId;
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
      });
    } else if (envBase64) {
      const credentials = JSON.parse(Buffer.from(envBase64, "base64").toString("utf-8"));
      projectId = credentials.project_id || projectId;
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
      });
    } else if (fs.existsSync(serviceAccountPath)) {
      auth = new google.auth.GoogleAuth({
        keyFile: serviceAccountPath,
        scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
      });
      projectId = await auth.getProjectId();
    } else {
      logger.warn("Firebase credentials not found (checked FIREBASE_SERVICE_ACCOUNT env and service-account.json)");
      return;
    }

    const client = await auth.getClient();
    const tokenRes = await client.getAccessToken();
    const accessToken = tokenRes.token;

    if (!accessToken) {
      logger.error("Failed to obtain Google access token for FCM");
      return;
    }

    const stringData: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      stringData[k] = typeof v === "string" ? v : JSON.stringify(v);
    }

    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title,
            body,
          },
          android: {
            priority: "high",
            collapse_key: data?.leaveId ? `leave_${data.leaveId}` : "leave_alert",
            notification: {
              channelId: "leaves",
              tag: data?.leaveId ? `leave_${data.leaveId}` : undefined,
            },
          },
          data: stringData,
        },
      }),
    });

    const resJson = await res.json().catch(() => ({}));
    logger.info("FCM HTTP v1 push response", { status: res.status, resJson });
  } catch (err) {
    logger.error("Error sending direct FCM push", err as Error);
  }
}

interface PushPayload {
  memberIds: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Register a device push token for a team member
 */
export async function registerDeviceToken(params: {
  memberId: string;
  token: string;
  platform?: string;
  type?: string;
}) {
  const { memberId, token, platform = "android", type = "expo" } = params;
  if (!memberId || !token) return null;

  try {
    const record = await getDeviceTokenModel().upsert({
      where: { token },
      update: {
        memberId,
        platform,
        type,
        updatedAt: new Date(),
      },
      create: {
        memberId,
        token,
        platform,
        type,
      },
    });
    logger.info("Device token registered successfully", { memberId, platform, type });
    return record;
  } catch (error) {
    logger.error("Failed to register device token", error as Error, { memberId });
    return null;
  }
}

/**
 * Unregister a device push token
 */
export async function unregisterDeviceToken(token: string) {
  if (!token) return;
  try {
    await getDeviceTokenModel().deleteMany({
      where: { token },
    });
    logger.info("Device token unregistered", { token });
  } catch (error) {
    logger.error("Failed to unregister device token", error as Error, { token });
  }
}

/**
 * Send push notifications to target team members using Expo Push Notification service
 */
export async function sendPushNotification({
  memberIds,
  title,
  body,
  data = {},
}: PushPayload): Promise<void> {
  if (!memberIds || memberIds.length === 0) return;

  try {
    const deviceTokens = await getDeviceTokenModel().findMany({
      where: {
        memberId: { in: memberIds },
      },
      select: {
        token: true,
        platform: true,
        memberId: true,
      },
    });

    if (deviceTokens.length === 0) {
      logger.info("No registered push device tokens found for members", { memberIds });
      return;
    }

    // Deduplicate device tokens so a physical device is never messaged multiple times
    const seen = new Set<string>();
    const uniqueTokens = deviceTokens.filter((dt) => {
      if (seen.has(dt.token)) return false;
      seen.add(dt.token);
      return true;
    });

    const expoTokens = uniqueTokens.filter((dt) => dt.token.startsWith("ExponentPushToken"));
    const fcmTokens = uniqueTokens.filter((dt) => !dt.token.startsWith("ExponentPushToken"));

    // 1. Send to FCM native tokens directly via Firebase Cloud Messaging
    for (const fcmDevice of fcmTokens) {
      await sendFcmNotification(fcmDevice.token, title, body, {
        ...data,
        targetMemberId: fcmDevice.memberId,
      });
    }

    // 2. Send to Expo push tokens via Expo Push API
    if (expoTokens.length > 0) {
      const messages = expoTokens.map((dt) => ({
        to: dt.token,
        sound: "default",
        title,
        body,
        data: {
          ...data,
          targetMemberId: dt.memberId,
        },
        channelId: "leaves",
        priority: "high",
        badge: 1,
      }));

      const chunkSize = 100;
      for (let i = 0; i < messages.length; i += chunkSize) {
        const chunk = messages.slice(i, i + chunkSize);
        try {
          const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(chunk),
          });

          const resData = await response.json().catch(() => ({}));
          logger.info("Expo push notifications sent", {
            count: chunk.length,
            status: response.status,
            response: resData,
          });
        } catch (chunkErr) {
          logger.error("Error sending push notification chunk", chunkErr as Error);
        }
      }
    }
  } catch (error) {
    logger.error("Failed to send push notifications", error as Error, { memberIds, title });
  }
}

/**
 * Notify all Founders (and specifically shiven@keymouse.com) about leave lifecycle events
 */
export async function notifyFounderLeaveEvent(params: {
  eventType: "applied" | "updated" | "approved" | "rejected" | "revoked";
  applicantName: string;
  leaveType: string;
  dates: string;
  leaveId: string;
  reason?: string | null;
  applicantMemberId?: string;
}) {
  const { eventType, applicantName, leaveType, dates, leaveId, reason, applicantMemberId } = params;

  try {
    // 1. Find all active Founders
    const founders = await prisma.teamMember.findMany({
      where: {
        active: true,
        OR: [
          { role: "Founder" },
          { email: "shiven@keymouse.com" },
        ],
      },
      select: { id: true, email: true },
    });

    const founderIds = [
      ...new Set(
        founders
          .map((f) => f.id)
          .filter((id) => id !== applicantMemberId)
      ),
    ];

    if (founderIds.length === 0) return;

    const formattedType = leaveType.replace(/_/g, " ");

    let title = "";
    let body = "";

    switch (eventType) {
      case "applied":
        title = `🌿 New Leave: ${applicantName}`;
        body = `${applicantName} applied for ${formattedType} (${dates}). Tap to review.`;
        break;
      case "updated":
        title = `✏️ Leave Updated: ${applicantName}`;
        body = `${applicantName} updated their ${formattedType} request (${dates}).`;
        break;
      case "approved":
        title = `✅ Leave Approved: ${applicantName}`;
        body = `${applicantName}'s ${formattedType} (${dates}) was approved.`;
        break;
      case "rejected":
        title = `❌ Leave Rejected: ${applicantName}`;
        body = `${applicantName}'s ${formattedType} (${dates}) was rejected.`;
        break;
      case "revoked":
        title = `🚫 Leave Revoked: ${applicantName}`;
        body = `${applicantName}'s leave (${dates}) was revoked.`;
        break;
    }

    if (reason && reason.trim()) {
      body += ` Reason: "${reason.trim()}"`;
    }

    await sendPushNotification({
      memberIds: founderIds,
      title,
      body,
      data: {
        url: "/leaves",
        targetTab: "leaves",
        initialAdminTab: "approvals",
        leaveId,
        eventType,
      },
    });
  } catch (error) {
    logger.error("Failed to notify founder of leave event", error as Error, { eventType, leaveId });
  }
}
