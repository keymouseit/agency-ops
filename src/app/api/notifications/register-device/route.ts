import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registerDeviceToken, unregisterDeviceToken } from "@/lib/push-notifications";

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
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Valid token is required." }, { status: 400 });
    }

    const record = await registerDeviceToken({
      memberId: targetMemberId,
      token: token.trim(),
      platform: platform || "android",
      type: type || "expo",
    });

    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    console.error("[register-device error]:", error);
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
