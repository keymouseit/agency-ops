import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sendLeaveAppliedEmail } from '@/lib/notifications';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const status = searchParams.get('status');

    const whereClause: { memberId?: string; status?: string } = {};
    if (memberId) {
      whereClause.memberId = memberId;
    }
    if (status) {
      whereClause.status = status;
    }

    const leaves = await prisma.leaveRequest.findMany({
      where: whereClause,
      include: {
        member: {
          select: { name: true, email: true }
        },
        approvedBy: {
          select: { name: true }
        }
      },
      orderBy: { startDate: 'desc' }
    });

    return NextResponse.json(leaves);
  } catch (error: unknown) {
    console.error('Error fetching leaves:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { memberId, leaveType, startDate, endDate, reason, timeSlot } = body;

    if (!memberId || !leaveType || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const start = new Date(startDate);
    
    // In a real app we would determine the user's role here via session.
    // Assuming standard employee checks for now:
    // Enforce future date for start date unless overridden
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // If we wanted to check if admin is applying, we'd look at body.isAdmin
    const isAdmin = body.isAdmin === true;
    if (!isAdmin && start < today) {
      return NextResponse.json({ error: 'Standard employees can only apply for future dates' }, { status: 400 });
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        memberId,
        leaveType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        timeSlot
      },
      include: { member: true }
    });

    try {
      const hrEmail = process.env.HR_EMAIL || process.env.SMTP_USER || 'hr@example.com';
      await sendLeaveAppliedEmail(leaveRequest, hrEmail);
    } catch (e) {
      console.error('Error sending applied email', e);
    }

    await prisma.auditLog.create({
      data: {
        userId: memberId,
        action: 'created',
        entityType: 'LeaveRequest',
        entityId: leaveRequest.id,
        entityName: 'Leave Request',
        changes: JSON.stringify({ status: 'pending' })
      }
    });

    return NextResponse.json(leaveRequest, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating leave request:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
