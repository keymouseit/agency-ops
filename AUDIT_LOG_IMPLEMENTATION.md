# Audit Log System - Implementation Plan

**Created:** 2026-05-12
**Status:** Proposed
**Priority:** P2 (High - Security & Compliance)

---

## Current State

**❌ No audit logging currently implemented**

The system currently tracks:
- ✅ `createdAt` timestamps on most models
- ✅ `updatedAt` timestamps on most models
- ❌ **No tracking of WHO made changes**
- ❌ **No tracking of WHAT was changed**
- ❌ **No historical record of changes**

---

## Why We Need Audit Logging

### 1. Security & Compliance
- Track who accessed sensitive data (team member salaries, client budgets)
- Detect unauthorized access attempts
- Meet compliance requirements (GDPR, SOC2)

### 2. Accountability
- Know who deactivated a team member
- Track who changed project status to "Delivered"
- See who approved/rejected estimates

### 3. Debugging & Recovery
- Understand what changed before a bug appeared
- Restore data if someone accidentally deletes something
- Trace cascade of changes (who changed what when)

### 4. Business Intelligence
- Analyze user behavior patterns
- Identify bottlenecks (who's delaying approvals)
- Track productivity (how fast estimates are reviewed)

### 5. Legal Protection
- Proof of who signed off on deliverables
- Evidence of when scope changes were approved
- Track of all client communications

---

## What to Audit

### Critical Actions (MUST LOG)

#### Team Management
- ✅ Team member created
- ✅ Team member updated (name, email, role, password changed)
- ✅ Team member activated/deactivated
- ✅ Team member deleted (soft delete)

#### Projects & Deliverables
- ✅ Project created
- ✅ Project status changed (especially → Delivered, Cancelled)
- ✅ Project owner changed
- ✅ Scope change added (with/without CO)
- ✅ Milestone created/updated/completed
- ✅ Post-mortem submitted

#### QA & Quality Gates
- ✅ QA test cycle logged (pass/fail/conditional)
- ✅ Release sign-off submitted (who signed off)
- ✅ Post-delivery issue logged (especially QA misses)

#### Estimates & Financials
- ✅ Estimation request created
- ✅ Estimate submitted by Dev
- ✅ Estimate approved/rejected by BD
- ✅ Budget changed on project/lead

#### Client Pipeline
- ✅ Lead created
- ✅ Lead status changed (especially → Won, Lost)
- ✅ Proposal logged
- ✅ Loss analysis added

#### Settings & Configuration
- ✅ Company settings changed
- ✅ Notification preferences changed
- ✅ Workflow defaults changed
- ✅ Custom statuses added/modified

### Important Actions (SHOULD LOG)

- Weekly check-in submitted
- Daily plan submitted
- EOD submitted
- Goal created/updated
- Weekly score submitted (by Founder)

### Low Priority (OPTIONAL)

- User login/logout
- Page views
- Search queries
- Filter changes

---

## Database Schema

### Option 1: Single Audit Log Table (Recommended)

**Pros:**
- Simple to query across all entities
- Easy to add new event types
- Centralized audit trail

**Cons:**
- Can grow very large (need partitioning/archival strategy)
- Generic JSON fields (less type-safe)

```prisma
model AuditLog {
  id            String   @id @default(cuid())

  // Who did it
  userId        String?  // null for system actions
  user          TeamMember? @relation(fields: [userId], references: [id])
  userEmail     String?  // Store email in case user is deleted
  userName      String?  // Store name in case user is deleted

  // What happened
  action        String   // "created", "updated", "deleted", "status_changed", etc.
  entityType    String   // "TeamMember", "Project", "Lead", "Estimate", etc.
  entityId      String   // ID of the affected record
  entityName    String?  // Human-readable name (project name, member name)

  // When
  timestamp     DateTime @default(now())

  // Details
  changes       Json?    // { field: { old: "value", new: "value" } }
  metadata      Json?    // Additional context (IP, user agent, etc.)

  // Context
  ipAddress     String?
  userAgent     String?

  @@index([userId])
  @@index([entityType, entityId])
  @@index([timestamp])
  @@index([action])
}
```

**Example Entries:**

```json
// Team member deactivated
{
  "userId": "cm123abc",
  "userEmail": "shiven@keymouse.com",
  "userName": "Shiven Juneja",
  "action": "deactivated",
  "entityType": "TeamMember",
  "entityId": "cm456def",
  "entityName": "Vishal Sharma",
  "timestamp": "2026-05-12T14:30:00Z",
  "changes": {
    "active": { "old": true, "new": false }
  },
  "metadata": { "reason": "Resigned" },
  "ipAddress": "192.168.1.100"
}

// Project status changed
{
  "userId": "cm789ghi",
  "userEmail": "vishal@keymouse.com",
  "userName": "Vishal Sharma",
  "action": "status_changed",
  "entityType": "Project",
  "entityId": "cm111jkl",
  "entityName": "Client Portal v2",
  "timestamp": "2026-05-12T15:45:00Z",
  "changes": {
    "status": { "old": "qa", "new": "delivered" }
  },
  "metadata": {
    "qaSignedOff": true,
    "signedOffBy": "Neha Joshi"
  }
}

// QA release sign-off
{
  "userId": "cm222mno",
  "userEmail": "neha@keymouse.com",
  "userName": "Neha Joshi",
  "action": "qa_signoff_submitted",
  "entityType": "Project",
  "entityId": "cm111jkl",
  "entityName": "Client Portal v2",
  "timestamp": "2026-05-12T15:30:00Z",
  "changes": null,
  "metadata": {
    "qualityScore": 9,
    "releaseNotes": "All core flows tested and passing.",
    "checklistPassed": true
  }
}
```

### Option 2: Per-Entity Audit Tables (Alternative)

**Pros:**
- Type-safe fields per entity
- Easier to maintain referential integrity
- Can enforce different retention per entity

**Cons:**
- Many tables to manage
- Harder to query across entities
- More code duplication

```prisma
model TeamMemberAudit {
  id              String      @id @default(cuid())
  memberId        String
  member          TeamMember  @relation(fields: [memberId], references: [id])
  action          String      // created, updated, deleted, activated, deactivated
  changes         Json
  performedBy     String?
  performedByUser TeamMember? @relation("AuditPerformedBy", fields: [performedBy], references: [id])
  timestamp       DateTime    @default(now())
}

model ProjectAudit {
  id              String      @id @default(cuid())
  projectId       String
  project         Project     @relation(fields: [projectId], references: [id])
  action          String
  changes         Json
  performedBy     String?
  performedByUser TeamMember? @relation("AuditPerformedBy", fields: [performedBy], references: [id])
  timestamp       DateTime    @default(now())
}

// ... repeat for each entity
```

**Recommendation:** Use **Option 1 (Single Audit Log)** - simpler, more flexible, easier to maintain.

---

## Implementation Strategy

### Phase 1: Core Infrastructure (4-6 hours)

**1.1 Create Audit Log Table**
```bash
# Add to schema.prisma
npx prisma db push
```

**1.2 Create Audit Helper Functions**
```typescript
// src/lib/audit.ts

import { prisma } from './prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

type AuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'status_changed'
  | 'activated'
  | 'deactivated'
  | 'signed_off'
  | 'approved'
  | 'rejected'

type AuditEntity =
  | 'TeamMember'
  | 'Project'
  | 'Lead'
  | 'Estimate'
  | 'TestCycle'
  | 'ReleaseSignOff'
  | 'Goal'
  | 'Settings'

interface AuditLogParams {
  action: AuditAction
  entityType: AuditEntity
  entityId: string
  entityName?: string
  changes?: Record<string, { old: any; new: any }>
  metadata?: Record<string, any>
  userId?: string // Optional, will use session if not provided
  ipAddress?: string
  userAgent?: string
}

export async function logAudit(params: AuditLogParams) {
  try {
    // Get user from session if not provided
    let userId = params.userId
    let userEmail: string | undefined
    let userName: string | undefined

    if (!userId) {
      const session = await getServerSession(authOptions)
      if (session?.user?.id) {
        userId = session.user.id
        userEmail = session.user.email || undefined
        userName = session.user.name || undefined
      }
    } else {
      // Fetch user details if userId provided
      const user = await prisma.teamMember.findUnique({
        where: { id: userId },
        select: { email: true, name: true }
      })
      userEmail = user?.email
      userName = user?.name
    }

    await prisma.auditLog.create({
      data: {
        userId,
        userEmail,
        userName,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        entityName: params.entityName,
        changes: params.changes || null,
        metadata: params.metadata || null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        timestamp: new Date(),
      },
    })
  } catch (error) {
    // Don't throw - audit logging should never break the app
    console.error('Failed to log audit:', error)
  }
}

// Helper to capture field changes
export function captureChanges<T extends Record<string, any>>(
  oldData: T,
  newData: Partial<T>
): Record<string, { old: any; new: any }> {
  const changes: Record<string, { old: any; new: any }> = {}

  for (const key in newData) {
    if (oldData[key] !== newData[key]) {
      changes[key] = {
        old: oldData[key],
        new: newData[key],
      }
    }
  }

  return changes
}

// Helper to get client IP from request
export function getClientIP(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  return realIp || undefined
}
```

**1.3 Example Usage in API Routes**

```typescript
// src/app/api/team/[id]/route.ts

import { logAudit, captureChanges, getClientIP } from '@/lib/audit'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['Founder', 'Manager'])
  if (deny) return deny

  const data = await req.json()

  // Get existing member before update
  const oldMember = await prisma.teamMember.findUnique({
    where: { id: params.id },
  })

  if (!oldMember) {
    return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
  }

  // Perform update
  const updated = await prisma.teamMember.update({
    where: { id: params.id },
    data: { ...updateData },
  })

  // Log the audit trail
  await logAudit({
    action: 'updated',
    entityType: 'TeamMember',
    entityId: params.id,
    entityName: updated.name,
    changes: captureChanges(oldMember, updateData),
    ipAddress: getClientIP(req),
    userAgent: req.headers.get('user-agent') || undefined,
  })

  return NextResponse.json(updated)
}
```

### Phase 2: Critical Actions (6-8 hours)

Add audit logging to:
- ✅ Team member CRUD (`/api/team/*`)
- ✅ Project status changes (`/api/projects/[id]/status`)
- ✅ QA sign-offs (`/api/qa/[id]/signoff`)
- ✅ Estimate approvals (`/api/estimate/[id]/approve`)
- ✅ Settings changes (`/api/settings/*`)

### Phase 3: Additional Actions (4-6 hours)

- QA test cycles
- Scope changes
- Lead status changes
- Goal management

### Phase 4: UI & Reporting (6-8 hours)

**4.1 Audit Log Viewer (Founder Only)**

New page: `/settings/audit-log`

Features:
- View all audit logs (paginated)
- Filter by:
  - User
  - Entity type
  - Action
  - Date range
  - Entity ID/name
- Search across all fields
- Export to CSV
- View detailed change diff

**4.2 Entity-Specific Audit Trail**

Show audit history on entity detail pages:
- Project detail page → "History" tab showing all changes
- Team member page → Change log
- Settings page → Recent changes

---

## UI Mockup: Audit Log Viewer

```
┌─────────────────────────────────────────────────────────────────┐
│ Settings > Audit Log                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Filters:                                                         │
│ [User: All ▼] [Entity: All ▼] [Action: All ▼] [Last 30 days ▼] │
│ [Search: client portal]                                          │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ Timestamp         │ User           │ Action         │ Entity ││
│ ├──────────────────────────────────────────────────────────────┤│
│ │ 2026-05-12 15:45  │ Vishal Sharma  │ status_changed │ Project││
│ │                   │                │ qa → delivered │         ││
│ │                   │                │ Client Portal v2│ [View] ││
│ ├──────────────────────────────────────────────────────────────┤│
│ │ 2026-05-12 15:30  │ Neha Joshi     │ qa_signoff     │ Project││
│ │                   │                │ Client Portal v2│ [View] ││
│ ├──────────────────────────────────────────────────────────────┤│
│ │ 2026-05-12 14:30  │ Shiven Juneja  │ deactivated    │ Member ││
│ │                   │                │ Vishal Sharma   │ [View] ││
│ ├──────────────────────────────────────────────────────────────┤│
│ │ 2026-05-12 10:15  │ Kavya Mehta    │ approved       │ Estimate││
│ │                   │                │ ABC Corp Website│ [View] ││
│ └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│ [← Previous] Page 1 of 23 [Next →]              [Export to CSV] │
└─────────────────────────────────────────────────────────────────┘
```

**Detail View (Modal):**

```
┌─────────────────────────────────────────────┐
│ Audit Log Entry Details                      │
├─────────────────────────────────────────────┤
│                                              │
│ Timestamp: 2026-05-12 15:45:22 IST          │
│ User: Vishal Sharma (vishal@keymouse.com)   │
│ IP Address: 192.168.1.105                   │
│                                              │
│ Action: status_changed                       │
│ Entity: Project - Client Portal v2          │
│ Entity ID: cm111jkl                          │
│                                              │
│ Changes:                                     │
│ ┌─────────────────────────────────────────┐ │
│ │ status                                   │ │
│ │ • Old: "qa"                              │ │
│ │ • New: "delivered"                       │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ Metadata:                                    │
│ ┌─────────────────────────────────────────┐ │
│ │ qaSignedOff: true                        │ │
│ │ signedOffBy: "Neha Joshi"               │ │
│ │ qualityScore: 9                          │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ [Close]                                      │
└─────────────────────────────────────────────┘
```

---

## Data Retention & Performance

### Retention Policy

**Keep Forever:**
- QA sign-offs (legal proof of delivery)
- Team member changes (HR compliance)
- Project delivery (client disputes)
- Financial changes (budget, estimates)

**Archive After 2 Years:**
- Daily plans
- Weekly check-ins
- Low-priority updates

**Purge After 1 Year:**
- Login/logout events (if tracked)
- Page views (if tracked)

### Performance Optimization

**Problem:** Audit log can grow to millions of records

**Solutions:**

1. **Partitioning by Date**
```prisma
// Separate tables for old data
model AuditLogArchive2025 {
  // Same schema as AuditLog
  // Contains only 2025 records
}
```

2. **Indexing**
```prisma
@@index([timestamp(sort: Desc)]) // Recent first
@@index([userId, timestamp])
@@index([entityType, entityId])
```

3. **Pagination**
```typescript
// Always paginate, never load all
const logs = await prisma.auditLog.findMany({
  take: 50,
  skip: page * 50,
  orderBy: { timestamp: 'desc' },
})
```

4. **Async Logging**
```typescript
// Don't await audit logs (fire and forget)
logAudit(params).catch(err => console.error('Audit failed:', err))
```

---

## Security & Privacy

### What NOT to Log

- ❌ **Passwords** (even hashed)
- ❌ **Session tokens**
- ❌ **Payment card details**
- ❌ **Full API keys** (log only last 4 chars)

### Access Control

**Who Can View Audit Logs:**
- ✅ Founder (all logs)
- ✅ Manager (team-related logs only)
- ❌ Dev/BD/QA (no access)

**Audit the Auditors:**
- Log who viewed the audit log
- Log who exported audit data
- Prevent tampering (no delete/edit of audit logs)

---

## Testing Checklist

- [ ] Audit log created when team member added
- [ ] Audit log captures old/new values correctly
- [ ] User info stored (handles deleted users)
- [ ] Timestamp is accurate with timezone
- [ ] IP address captured correctly
- [ ] Changes field shows field-level diffs
- [ ] Metadata captures context correctly
- [ ] System actions (no user) handled
- [ ] Concurrent updates don't lose audit trails
- [ ] Failed audit logging doesn't break app
- [ ] Audit log viewer loads and filters work
- [ ] Export to CSV works
- [ ] Only authorized users can view logs

---

## Migration Plan

### Step 1: Add Schema (0.5 hour)
```bash
# Add AuditLog model to schema.prisma
npx prisma db push
```

### Step 2: Create Helpers (1 hour)
```bash
# Create src/lib/audit.ts
# Add logAudit, captureChanges, getClientIP functions
```

### Step 3: Implement in Critical APIs (6-8 hours)
- Team member CRUD
- Project status changes
- QA workflows
- Settings changes

### Step 4: Create Audit Log Viewer UI (4-6 hours)
- `/settings/audit-log` page
- Filters and search
- Detail modal
- Export function

### Step 5: Add Entity History Tabs (4-6 hours)
- Project history tab
- Team member change log
- Settings change log

**Total Estimated Effort:** 16-22 hours

---

## Cost-Benefit Analysis

### Costs
- **Development:** ~20 hours
- **Storage:** ~10GB per year (estimated)
- **Performance:** Minimal (async logging)

### Benefits
- **Security:** Track unauthorized access
- **Compliance:** Meet audit requirements
- **Debugging:** Understand what changed
- **Recovery:** Restore accidental deletions
- **Legal:** Proof of who approved what
- **Analytics:** User behavior insights

**ROI:** High - Essential for professional agency management system

---

## Recommended Action

**Phase 1 (Critical):** Implement core audit logging for:
- Team member changes
- Project delivery
- QA sign-offs
- Settings changes

**Estimated Effort:** 10-12 hours
**Timeline:** 1-2 days
**Priority:** P2 (High)

**Phase 2 (Important):** Add audit log viewer UI
**Estimated Effort:** 6-8 hours

**Phase 3 (Nice to Have):** Entity-specific history tabs
**Estimated Effort:** 4-6 hours

---

**End of Implementation Plan**
