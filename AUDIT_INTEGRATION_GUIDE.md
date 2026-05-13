# Audit Module - Integration Guide

## Overview

The audit module provides two levels of visibility:

1. **System-wide Audit Log** (`/settings/audit-log`) - Founder-only, shows ALL changes across the entire system
2. **Entity-specific Audit Trails** - Shown on individual pages (projects, leads, QA), visible to all team members with access

---

## Integration: Adding Audit Trails to Entity Pages

### How to Add the Audit Trail Component

The `EntityAuditTrail` component is a reusable component that can be embedded in any entity detail page. Here's how:

#### Example 1: Project Detail Page

**File:** `src/app/projects/[id]/page.tsx`

```tsx
import EntityAuditTrail from '@/components/EntityAuditTrail'

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  // ... existing code to fetch project ...

  return (
    <div>
      {/* Existing project details */}
      <div className="space-y-6">
        {/* Project info, status, etc. */}

        {/* Add Audit Trail */}
        <EntityAuditTrail
          entityType="Project"
          entityId={params.id}
          title="Project History"
        />
      </div>
    </div>
  )
}
```

#### Example 2: Lead/Pipeline Detail Page

**File:** `src/app/pipeline/[id]/page.tsx`

```tsx
import EntityAuditTrail from '@/components/EntityAuditTrail'

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  // ... existing code ...

  return (
    <div>
      {/* Lead details */}

      {/* Audit Trail */}
      <EntityAuditTrail
        entityType="Lead"
        entityId={params.id}
        title="Lead Activity History"
      />
    </div>
  )
}
```

#### Example 3: QA Project Page

**File:** `src/app/qa/[id]/page.tsx`

```tsx
import EntityAuditTrail from '@/components/EntityAuditTrail'

export default async function QAProjectPage({ params }: { params: { id: string } }) {
  // ... existing code ...

  return (
    <div>
      {/* QA details, test cycles, etc. */}

      {/* Audit Trail - shows test cycles, sign-offs, status changes */}
      <EntityAuditTrail
        entityType="Project"
        entityId={params.id}
        title="QA History"
      />
    </div>
  )
}
```

#### Example 4: Team Member Page

**File:** `src/app/settings/members/[id]/page.tsx`

```tsx
import EntityAuditTrail from '@/components/EntityAuditTrail'

export default async function TeamMemberPage({ params }: { params: { id: string } }) {
  // ... existing code ...

  return (
    <div>
      {/* Member details */}

      {/* Audit Trail - shows role changes, activations, etc. */}
      <EntityAuditTrail
        entityType="TeamMember"
        entityId={params.id}
        title="Member Change Log"
      />
    </div>
  )
}
```

---

## Component Props

### `EntityAuditTrail`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `entityType` | `string` | Yes | The type of entity (e.g., "Project", "Lead", "TeamMember") |
| `entityId` | `string` | Yes | The ID of the specific entity |
| `title` | `string` | No | Custom title for the audit trail section (default: "Change History") |

---

## Supported Entity Types

- `TeamMember` - Team member changes (role, status, etc.)
- `Project` - Project updates, status changes
- `Lead` - Lead status changes, owner changes
- `Estimate` - Estimation changes
- `TestCycle` - QA test cycle submissions
- `ReleaseSignOff` - QA release sign-offs
- `Goal` - Goal creation and updates
- `Settings` - Settings changes
- `ScopeChange` - Scope change additions
- `CheckIn` - Check-in submissions
- `PostDeliveryIssue` - Post-delivery issue logging

---

## Features of the Entity Audit Trail

### Visual Display
- Timeline view with dots
- Color-coded action badges
- Expandable/collapsible (shows 5 by default, can expand to see all)
- Responsive design

### Information Shown
- **Action** - What happened (created, updated, status_changed, etc.)
- **User** - Who made the change
- **Changes** - Field-level diff (old vs new values)
- **Timestamp** - When it happened
- **Metadata** - Additional context

### Detail Modal
- Click "Details" on any entry to see full information
- Shows complete change diff
- Displays metadata and context
- Shows IP address (if logged)

---

## Access Control

### System-wide Audit Log (`/settings/audit-log`)
- **Access:** Founder only
- **Purpose:** Compliance, security auditing, system-wide analysis
- **Features:** Full filtering, search, export to CSV

### Entity-specific Audit Trails
- **Access:** All users who can view the entity
- **Purpose:** Transparency, collaboration, understanding changes
- **Features:** Shows last 100 entries for that specific entity

---

## What Gets Logged Automatically

The audit module is already integrated into these critical actions:

### ✅ Team Management
- Team member created
- Team member updated (name, email, role, active status)
- Password changed
- Activated/Deactivated

### ✅ Projects
- Project status changed
- Project created (if you add the logging)
- Project owner changed (if you add the logging)

### ✅ QA Module
- Test cycle submitted (pass/fail/conditional)
- Release sign-off submitted
- Test cycle details (result, environment, blockers)

### 🔲 Not Yet Logged (Easy to Add)
- Lead status changes
- Estimate submissions/approvals
- Scope changes
- Goal creation
- Settings changes
- Weekly check-ins

---

## How to Add Logging to More Actions

### Example: Log Lead Status Changes

**File:** `src/app/api/leads/[id]/status/route.ts`

```typescript
import { logAudit, captureChanges, getClientIP } from '@/lib/audit'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  // ... authorization ...

  const data = await req.json()

  // Get old lead data
  const oldLead = await prisma.lead.findUnique({ where: { id: params.id } })

  // Update lead
  const updated = await prisma.lead.update({
    where: { id: params.id },
    data: { status: data.status },
  })

  // Log audit trail
  await logAudit({
    action: 'status_changed',
    entityType: 'Lead',
    entityId: params.id,
    entityName: updated.clientName,
    changes: captureChanges(oldLead, { status: data.status }),
    metadata: {
      lostReason: data.lostReason, // if applicable
    },
    ipAddress: getClientIP(req),
    userAgent: req.headers.get('user-agent') || undefined,
  })

  return NextResponse.json(updated)
}
```

---

## Best Practices

### When to Log
✅ **DO log:**
- Status changes (lead, project, etc.)
- Critical updates (owner changes, role changes)
- Approvals/rejections
- Sign-offs and deliveries
- Financial changes (budget, estimates)
- Security-related actions (password changes, deactivations)

❌ **DON'T log:**
- Read operations (viewing pages)
- Trivial updates (UI preferences, sort orders)
- Automated system actions (unless significant)
- Temporary drafts (log only on final submission)

### What to Include in Changes
- Only include fields that actually changed
- Use `captureChanges()` helper to auto-detect changes
- Don't log sensitive data (passwords, tokens)

### What to Include in Metadata
- Context that explains WHY the change was made
- Related entity IDs (e.g., which test cycle was signed off)
- Scores, ratings, or quality indicators
- User-provided reasons or notes

---

## Recommended Integration Points

Add `EntityAuditTrail` component to these pages:

### High Priority
1. ✅ **Project Detail Page** - `/projects/[id]`
   - Shows status changes, owner changes, QA handoffs

2. ✅ **QA Project Page** - `/qa/[id]`
   - Shows test cycles, sign-offs

3. ✅ **Lead/Pipeline Detail** - `/pipeline/[id]`
   - Shows status changes, owner changes

### Medium Priority
4. **Settings Pages**
   - Team member detail
   - Company settings

5. **Estimate Detail** - `/estimate/[id]`
   - Shows submissions, approvals, revisions

### Nice to Have
6. **Goal Detail Pages**
7. **Weekly Score History**
8. **Daily Log History**

---

## Troubleshooting

### Audit trail not showing up?
1. Check that the entity type matches exactly (case-sensitive)
2. Verify the entity ID is correct
3. Check browser console for API errors
4. Ensure audit logging was added to the relevant API route

### Audit logs not being created?
1. Check that `logAudit()` is being called in the API route
2. Look at server logs (file logs if enabled)
3. Verify the user session exists (logs show "System" if no user)
4. Check that the API route is actually being hit

### Changes not showing correctly?
1. Use `captureChanges()` helper to auto-detect changes
2. Make sure you're passing old data and new data correctly
3. Check that field names match between old and new

---

## Example: Complete Integration

Here's a complete example of adding audit trail to a project page:

**File:** `src/app/projects/[id]/page.tsx`

```tsx
import { prisma } from '@/lib/prisma'
import EntityAuditTrail from '@/components/EntityAuditTrail'

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      owner: true,
      checkIns: true,
      scopeChanges: true,
    },
  })

  if (!project) {
    return <div>Project not found</div>
  }

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="card p-6">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-gray-600">Status: {project.status}</p>
      </div>

      {/* Project Details */}
      <div className="grid grid-cols-2 gap-6">
        <div className="card p-6">
          {/* Project info */}
        </div>
        <div className="card p-6">
          {/* More project info */}
        </div>
      </div>

      {/* Audit Trail - Shows complete project history */}
      <EntityAuditTrail
        entityType="Project"
        entityId={params.id}
        title="Project History"
      />
    </div>
  )
}
```

---

## Summary

- ✅ Audit module is fully functional
- ✅ System-wide logs at `/settings/audit-log` (Founder only)
- ✅ Entity-specific audit trails via `EntityAuditTrail` component
- ✅ Already logging: team members, projects, QA actions
- 🔲 Need to add: More entity pages, lead status changes, estimates

**Next Steps:**
1. Add `EntityAuditTrail` to project, lead, and QA detail pages
2. Test audit logging on key actions
3. Add logging to additional API routes (leads, estimates) as needed
