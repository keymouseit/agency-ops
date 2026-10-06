import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  registerDeviceToken,
  unregisterDeviceToken,
  unregisterAllDeviceTokensForMember,
} from "@/lib/push-notifications";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await auth();
    const body = await request.json().catch(() => ({}));
    const { token, platform, type, memberId, email } = body;

    let targetMemberId = session?.user?.id;
    if (!targetMemberId && memberId) {
      targetMemberId = memberId;
    }
    if (!targetMemberId && email) {
      const member = await prisma.teamMember.findUnique({
        where: { email: String(email).trim().toLowerCase() },
        select: { id: true },
      });
      if (member) targetMemberId = member.id;
    }

    if (!targetMemberId) {
      console.warn("[PUSH NOTIFICATION REGISTER] ⚠️ Rejected: Sign in required or member not found. Body:", body);
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    if (!token || typeof token !== "string") {
      console.warn("[PUSH NOTIFICATION REGISTER] ⚠️ Rejected: Valid token required. Body:", body);
      return NextResponse.json({ error: "Valid token is required." }, { status: 400 });
    }

    const cleanToken = token.trim();
    const cleanPlatform = (platform || "android").toLowerCase();
    const cleanType = (type || (cleanToken.startsWith("ExponentPushToken") ? "expo" : cleanPlatform === "ios" ? "apns" : "fcm")).toLowerCase();

    console.log(`[push] Registered ${cleanPlatform} device (${cleanType}) for ${email || targetMemberId}`);

    const record = await registerDeviceToken({
      memberId: targetMemberId,
      token: cleanToken,
      platform: cleanPlatform,
      type: cleanType,
    });

    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    console.error("❌ [PUSH NOTIFICATION REGISTER ERROR]:", error);
    return NextResponse.json({ error: error.message || "Failed to register device" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const all = searchParams.get("all");

    if (all === "1" || all === "true") {
      await unregisterAllDeviceTokensForMember(session.user.id);
      return NextResponse.json({ success: true });
    }

    if (!token) {
      return NextResponse.json({ error: "Token is required." }, { status: 400 });
    }

    await unregisterDeviceToken(token);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[unregister-device error]:", error);
    return NextResponse.json({ error: error.message || "Failed to unregister device" }, { status: 500 });
  }
}
