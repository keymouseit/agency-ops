import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        member: { select: { name: true } },
        approvedBy: { select: { name: true } }
      }
    });

    if (!leave) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: 'LeaveRequest',
        entityId: id
      },
      include: {
        user: { select: { name: true } }
      },
      orderBy: { timestamp: 'asc' }
    });

    // Synthesize logs for legacy leave requests created before the auditing system
    if (logs.length === 0) {
      logs.push({
        id: 'synthetic-created',
        entityType: 'LeaveRequest',
        entityId: leave.id,
        action: 'created',
        changes: null,
        metadata: null,
        userId: leave.memberId,
        timestamp: leave.appliedAt,
        user: { name: leave.member.name }
      } as any);

      if (leave.status !== 'pending') {
        logs.push({
          id: 'synthetic-status',
          entityType: 'LeaveRequest',
          entityId: leave.id,
          action: 'status_changed',
          changes: JSON.stringify({ status: { old: 'pending', new: leave.status } }),
          metadata: null,
          userId: leave.approvedById || leave.memberId,
          timestamp: leave.appliedAt, // Fallback to appliedAt since we don't have the real approval time
          user: { name: leave.approvedBy?.name || 'Admin' }
        } as any);
      }
    }

    return NextResponse.json(logs);
  } catch (error: unknown) {
    console.error('Error fetching audit logs:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
