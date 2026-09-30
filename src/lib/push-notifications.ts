import { prisma } from "@/lib/prisma";

// Dynamic model accessor ensuring live PrismaClient instance
const getDeviceTokenModel = () => (prisma as any).deviceToken;
import { logger } from "@/lib/logger";
import { google } from "googleapis";
import path from "path";
import fs from "fs";

import { sendApnsPush } from "@/lib/apns-push";

/**
 * Send push notification directly via Firebase Cloud Messaging HTTP v1 API (supports Android & iOS APNs relay)
 */
async function sendFcmNotification(token: string, title: string, body: string, data: Record<string, any> = {}, platform = "android") {
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
      console.warn("⚠️ [FCM PUSH] Firebase credentials not found (checked FIREBASE_SERVICE_ACCOUNT env and service-account.json)");
      return;
    }

    const client = await auth.getClient();
    const tokenRes = await client.getAccessToken();
    const accessToken = tokenRes.token;

    if (!accessToken) {
      console.error("❌ [FCM PUSH] Failed to obtain Google access token for FCM");
      return;
    }

    const stringData: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      stringData[k] = typeof v === "string" ? v : JSON.stringify(v);
    }

    console.log(`🔥 [PUSH NOTIFICATION - FCM DISPATCH]`);
    console.log(`   Target Token: ${token.substring(0, 20)}...`);
    console.log(`   Platform: ${platform.toUpperCase()}`);
    console.log(`   Project ID: ${projectId}`);
    console.log(`   Title: "${title}"`);

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
              sound: "default",
            },
          },
          apns: {
            headers: {
              "apns-priority": "10",
              "apns-push-type": "alert",
              "apns-topic": "com.keymouseit.agencyops",
            },
            payload: {
              aps: {
                alert: {
                  title,
                  subtitle: "Agency Ops",
                  body,
                },
                sound: "default",
                badge: 1,
              },
            },
          },
          data: stringData,
        },
      }),
    });

    const resJson = await res.json().catch(() => ({}));
    if (res.ok) {
      console.log(`✅ [FCM PUSH SUCCESS] Status: ${res.status}, Name: ${resJson.name || "Sent"}`);
    } else {
      console.warn(`⚠️ [FCM PUSH FAILED] Status: ${res.status}, Error:`, JSON.stringify(resJson, null, 2));
    }
  } catch (err: any) {
    console.error("❌ [FCM PUSH EXCEPTION]:", err?.message || err);
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
    console.log(`💾 [DEVICE TOKEN DB UPSERT] Member: ${memberId} | Platform: ${platform} | Type: ${type}`);
    logger.info("Device token registered successfully", { memberId, platform, type });
    return record;
  } catch (error) {
    console.error("❌ [DEVICE TOKEN DB ERROR]:", error);
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
    console.log(`🗑️ [DEVICE TOKEN DB DELETE] Token removed: ${token.substring(0, 15)}...`);
    logger.info("Device token unregistered", { token });
  } catch (error) {
    console.error("❌ [DEVICE TOKEN UNREGISTER ERROR]:", error);
    logger.error("Failed to unregister device token", error as Error, { token });
  }
}

/**
 * Send push notifications to target team members using Expo Push Notification service and Direct APNs/FCM
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
        type: true,
        memberId: true,
      },
    });

    if (deviceTokens.length === 0) {
      return;
    }

    // Deduplicate device tokens
    const seen = new Set<string>();
    const uniqueTokens = deviceTokens.filter((dt: any) => {
      if (seen.has(dt.token)) return false;
      seen.add(dt.token);
      return true;
    });

    console.log(`[push] Dispatching "${title}" to ${uniqueTokens.length} device(s)`);

    const expoTokens = uniqueTokens.filter((dt: any) => dt.token.startsWith("ExponentPushToken"));
    const nativeTokens = uniqueTokens.filter((dt: any) => !dt.token.startsWith("ExponentPushToken"));
    const apnsTokens = nativeTokens.filter((dt: any) => (dt.platform || "").toLowerCase() === "ios" || (dt.type || "").toLowerCase() === "apns");
    const fcmTokens = nativeTokens.filter((dt: any) => (dt.platform || "").toLowerCase() !== "ios" && (dt.type || "").toLowerCase() !== "apns");

    // 1. Direct Apple APNs Dispatch (Identical to bookone-server)
    for (const apnsDevice of apnsTokens) {
      const apnsResult = await sendApnsPush(apnsDevice.token, {
        title,
        body,
        data,
      });
      if (!apnsResult.ok) {
        console.warn(`[push][apns] Delivery failed for ${apnsDevice.token.slice(0, 8)}... (${apnsResult.reason || "failed"})`);
      }
    }

    // 2. Direct FCM native tokens (Android)
    for (const fcmDevice of fcmTokens) {
      await sendFcmNotification(fcmDevice.token, title, body, {
        ...data,
        targetMemberId: fcmDevice.memberId,
      }, "android");
    }

    // 3. Expo Push API (Handles both iOS and Android automatically)
    if (expoTokens.length > 0) {
      const messages = expoTokens.map((dt: any) => ({
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

          if (!response.ok) {
            console.warn(`[push][expo] Chunk dispatch status ${response.status}`);
          }
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

    console.log(`[leave-event] ${eventType.toUpperCase()} by ${applicantName} (${dates}) -> notifying ${founderIds.length} founder(s)`);

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
