import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sendLeaveApprovalEmail, sendLeaveRejectedEmail } from '@/lib/notifications';
import { addEventToGoogleCalendar } from '@/lib/gcal';
import { checkRole } from '@/lib/auth';

const prisma = new PrismaClient();

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const deny = await checkRole(['Founder', 'HR', 'Manager']);
    if (deny) return deny;

    const { id } = params;
    const body = await request.json();
    const { approvedById, status, approvalNotes } = body;

    if (!approvedById || !status) {
      return NextResponse.json({ error: 'Missing approvedById or status' }, { status: 400 });
    }

    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Get the leave request first
    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { member: true }
    });

    if (!leave) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    if (leave.status === 'approved') {
      return NextResponse.json({ error: 'Leave request is already approved' }, { status: 400 });
    }

    // Update the leave request
    const updatedLeave = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        approvedById,
        approvalNotes,
        approvedAt: new Date()
      },
      include: { member: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: approvedById,
        action: 'status_changed',
        entityType: 'LeaveRequest',
        entityId: updatedLeave.id,
        entityName: 'Leave Request',
        changes: JSON.stringify({ status: { old: leave.status, new: status } }),
        metadata: JSON.stringify({ notes: approvalNotes })
      }
    });

    // Create in-app notification for the employee
    const approver = await prisma.teamMember.findUnique({ where: { id: approvedById } });
    await prisma.notification.create({
      data: {
        memberId: leave.memberId,
        type: `leave_${status}`,
        message: `Your leave request was ${status} by ${approver?.name || 'an admin'}.`,
        linkTo: '/leaves'
      }
    });

    // Deduct from balance if approved
    if (status === 'approved') {
      const year = new Date().getFullYear();
      let deduction = 1.0;
      if (leave.leaveType === 'short_leave') deduction = 0.25;
      else if (leave.leaveType === 'half_day') deduction = 0.5;

      // Upsert leave balance to deduct
      await prisma.leaveBalance.upsert({
        where: {
          memberId_year: {
            memberId: leave.memberId,
            year
          }
        },
        update: {
          used: { increment: deduction }
        },
        create: {
          memberId: leave.memberId,
          year,
          used: deduction
        }
      });

      // Send email notification
      try {
        await sendLeaveApprovalEmail(updatedLeave);
        // Also add to Google Calendar
        await addEventToGoogleCalendar(updatedLeave);
      } catch (emailError) {
        console.error('Failed to send email/calendar invite:', emailError);
        // Continue, as the DB was updated successfully
      }
    } else if (status === 'rejected') {
      try {
        await sendLeaveRejectedEmail(updatedLeave);
      } catch (emailError) {
        console.error('Failed to send rejected email:', emailError);
      }
    }

    return NextResponse.json(updatedLeave);
  } catch (error: unknown) {
    console.error('Error updating leave status:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
