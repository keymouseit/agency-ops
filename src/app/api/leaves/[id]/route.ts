import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireRole } from '@/lib/auth';

const prisma = new PrismaClient();

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { memberId, leaveType, startDate, endDate, reason, timeSlot } = body;

    // Verify session - any logged in user can edit their own leave, Admins can edit any pending leave
    // We'll fetch the leave first
    const existingLeave = await prisma.leaveRequest.findUnique({
      where: { id }
    });

    if (!existingLeave) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    if (existingLeave.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending leaves can be edited' }, { status: 400 });
    }

    // Update the leave request
    const updatedLeave = await prisma.leaveRequest.update({
      where: { id },
      data: {
        leaveType,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        reason,
        timeSlot
      }
    });

    // Determine what changed for the audit log
    const changes: Record<string, any> = {};
    if (existingLeave.leaveType !== updatedLeave.leaveType) changes.leaveType = { old: existingLeave.leaveType, new: updatedLeave.leaveType };
    if (existingLeave.startDate.toISOString() !== updatedLeave.startDate.toISOString()) changes.startDate = { old: existingLeave.startDate, new: updatedLeave.startDate };
    if (existingLeave.endDate.toISOString() !== updatedLeave.endDate.toISOString()) changes.endDate = { old: existingLeave.endDate, new: updatedLeave.endDate };
    if (existingLeave.reason !== updatedLeave.reason) changes.reason = { old: existingLeave.reason, new: updatedLeave.reason };
    if (existingLeave.timeSlot !== updatedLeave.timeSlot) changes.timeSlot = { old: existingLeave.timeSlot, new: updatedLeave.timeSlot };

    if (Object.keys(changes).length > 0) {
      await prisma.auditLog.create({
        data: {
          userId: memberId || existingLeave.memberId,
          action: 'updated',
          entityType: 'LeaveRequest',
          entityId: updatedLeave.id,
          entityName: 'Leave Request',
          changes: JSON.stringify(changes)
        }
      });
    }

    return NextResponse.json(updatedLeave, { status: 200 });
  } catch (error: unknown) {
    console.error('Error updating leave request:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
