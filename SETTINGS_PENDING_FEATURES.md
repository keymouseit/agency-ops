# Settings Module - Pending Features & Implementation Plan

**Created:** 2026-05-12
**Status:** Planning Phase
**Priority:** P3 (Non-Critical Enhancements)

---

## Overview

The Settings module currently has **Team Members** tab fully implemented. Three additional tabs need to be developed:

- ✅ **Tab 1: Team Members** - COMPLETED
- ⏳ **Tab 2: Company Profile** - PENDING
- ⏳ **Tab 3: Notifications** - PENDING
- ⏳ **Tab 4: Workflow** - PENDING

**Current Implementation:**
- Navigation: `src/components/Nav.tsx:21`
- Page: `src/app/settings/page.tsx`
- Client: `src/app/settings/SettingsClient.tsx`
- Team Members Tab: `src/app/settings/TeamMembersTab.tsx`
- API: `src/app/api/team/route.ts`, `src/app/api/team/[id]/route.ts`

**Access Control:**
- Visible to: Founder, Manager
- Hidden from: Dev, BD, QA, Both

---

## Tab 2: Company Profile

### Purpose
Manage company-wide settings that affect all users and system behavior.

### Features to Implement

#### 2.1 Company Information
- **Company Name** (text input)
  - Default: "Agency Ops"
  - Used in: Email notifications, invoices, client-facing documents

- **Company Logo** (image upload)
  - Format: PNG, JPG (max 2MB)
  - Dimensions: Recommended 200x200px
  - Display: Navbar, login page, reports

- **Industry/Type** (dropdown)
  - Options: Software Agency, Marketing Agency, Design Agency, Consulting, Custom

- **Team Size** (number)
  - Used for: Analytics benchmarking

#### 2.2 Working Hours & Calendar
- **Business Days** (checkboxes)
  - Default: Mon-Fri
  - Affects: Daily planning gates, deadline calculations

- **Business Hours** (time range)
  - Default: 9:00 AM - 6:00 PM
  - Timezone: Auto-detected or manual selection
  - Affects: EOD deadline reminders, notification timing

- **Public Holidays** (calendar picker)
  - Add custom holidays
  - Import country-specific holiday calendar
  - Affects: Daily planning gates, capacity calculations

#### 2.3 Financial Settings
- **Default Currency** (dropdown)
  - Options: USD, EUR, GBP, INR, AUD, CAD
  - Used in: Pipeline, estimates, projects

- **Default Hourly Rate** (number)
  - Used as default in estimation requests
  - Can be overridden per estimate

- **Tax Rate %** (number, optional)
  - For margin calculations

#### 2.4 Client Communication
- **Default Email Signature** (rich text)
  - Used in automated emails

- **Support Email** (email input)
  - Displayed to clients for support requests

- **Website URL** (URL input)
  - Optional, for client-facing materials

### Database Schema

```prisma
model CompanySettings {
  id                  String   @id @default(cuid())
  companyName         String   @default("Agency Ops")
  industry            String?
  teamSize            Int?

  // Working hours
  businessDays        String   @default("1,2,3,4,5") // 0=Sun, 1=Mon, etc.
  businessHoursStart  String   @default("09:00")
  businessHoursEnd    String   @default("18:00")
  timezone            String   @default("UTC")

  // Financial
  defaultCurrency     String   @default("USD")
  defaultHourlyRate   Float?
  taxRate             Float?

  // Client communication
  emailSignature      String?
  supportEmail        String?
  websiteUrl          String?

  // System
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

model PublicHoliday {
  id          String   @id @default(cuid())
  date        DateTime
  name        String
  recurring   Boolean  @default(false) // True for yearly recurring holidays
  createdAt   DateTime @default(now())
}
```

### API Endpoints

```typescript
// GET /api/settings/company - Fetch company settings
// PATCH /api/settings/company - Update company settings
// POST /api/settings/holidays - Add public holiday
// DELETE /api/settings/holidays/[id] - Remove holiday
```

### Implementation Files

**New Files:**
- `src/app/settings/CompanyProfileTab.tsx` - Client component
- `src/app/api/settings/company/route.ts` - GET, PATCH
- `src/app/api/settings/holidays/route.ts` - POST
- `src/app/api/settings/holidays/[id]/route.ts` - DELETE

**Modified Files:**
- `prisma/schema.prisma` - Add CompanySettings, PublicHoliday models
- `src/app/settings/SettingsClient.tsx` - Import CompanyProfileTab
- `src/app/settings/page.tsx` - Fetch company settings

### UI Mockup Structure

```
┌─────────────────────────────────────────────┐
│ Company Profile                              │
├─────────────────────────────────────────────┤
│ Company Information                          │
│ ┌─────────────────────────────────────────┐ │
│ │ Company Name: [Agency Ops          ]    │ │
│ │ Industry:     [Software Agency ▼   ]    │ │
│ │ Team Size:    [12                  ]    │ │
│ │ Logo:         [📷 Upload Image]          │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ Working Hours                                │
│ ┌─────────────────────────────────────────┐ │
│ │ Business Days: ☑M ☑T ☑W ☑T ☑F ☐S ☐S    │ │
│ │ Hours: [09:00] to [18:00]               │ │
│ │ Timezone: [Asia/Kolkata ▼]              │ │
│ │                                          │ │
│ │ Public Holidays (3 configured)           │ │
│ │ • 26 Jan 2026 - Republic Day            │ │
│ │ • 15 Aug 2026 - Independence Day        │ │
│ │ • 2 Oct 2026 - Gandhi Jayanti           │ │
│ │ [+ Add Holiday]                          │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ Financial Settings                           │
│ ┌─────────────────────────────────────────┐ │
│ │ Default Currency: [USD ▼]               │ │
│ │ Default Rate: [$50/hour]                │ │
│ │ Tax Rate: [18%] (optional)              │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ [Save Changes]                               │
└─────────────────────────────────────────────┘
```

### Test Scenarios

**TC-CompanyProfile-001:** Update company name
**TC-CompanyProfile-002:** Upload company logo (valid/invalid formats)
**TC-CompanyProfile-003:** Change business hours
**TC-CompanyProfile-004:** Add/remove public holidays
**TC-CompanyProfile-005:** Change default currency
**TC-CompanyProfile-006:** Update timezone

---

## Tab 3: Notifications

### Purpose
Configure which notifications users receive and how they're delivered.

### Features to Implement

#### 3.1 Notification Preferences (Per User)
Allow each user to customize their notification settings.

**Notification Types:**
- **Project Assigned** - When a project is assigned to you
- **Estimate Requested** - When BD requests an estimate
- **Estimate Needs Review** - When Dev submits estimate for BD review
- **QA Test Failed** - When QA marks your project as failed
- **QA Test Passed** - When QA marks your project as passed/conditional
- **Release Signed Off** - When QA signs off your project for delivery
- **Deadline Approaching** - 24h before estimate/milestone deadline
- **Missing EOD** - When you haven't submitted EOD by 8pm
- **Missing Morning Plan** - When you haven't submitted plan by 10am
- **Weekly Check-In Due** - Monday morning reminder

**Delivery Channels (Future Enhancement):**
- ✅ In-App Bell (always enabled)
- 📧 Email (optional)
- 📱 Browser Push (optional)

#### 3.2 System-Wide Notification Settings (Founder Only)
- **Enable/Disable Notification System** - Master switch
- **Default Settings for New Users** - What notifications are on by default
- **Quiet Hours** - Don't send notifications during specific times
  - Default: 10pm - 7am
- **Weekend Notifications** - Enable/disable weekend notifications

#### 3.3 Notification History
- View last 30 days of notifications
- Filter by type, date, read/unread
- Mark all as read
- Clear old notifications

### Database Schema

```prisma
model NotificationPreference {
  id                      String      @id @default(cuid())
  memberId                String
  member                  TeamMember  @relation(fields: [memberId], references: [id])

  // Notification types
  projectAssigned         Boolean     @default(true)
  estimateRequested       Boolean     @default(true)
  estimateNeedsReview     Boolean     @default(true)
  qaTestFailed            Boolean     @default(true)
  qaTestPassed            Boolean     @default(true)
  releaseSignedOff        Boolean     @default(true)
  deadlineApproaching     Boolean     @default(true)
  missingEOD              Boolean     @default(true)
  missingMorningPlan      Boolean     @default(true)
  weeklyCheckInDue        Boolean     @default(true)

  // Delivery channels (future)
  emailEnabled            Boolean     @default(false)
  pushEnabled             Boolean     @default(false)

  createdAt               DateTime    @default(now())
  updatedAt               DateTime    @updatedAt

  @@unique([memberId])
}

model SystemNotificationSettings {
  id                      String      @id @default(cuid())
  notificationsEnabled    Boolean     @default(true)
  quietHoursStart         String      @default("22:00")
  quietHoursEnd           String      @default("07:00")
  weekendNotifications    Boolean     @default(false)
  updatedAt               DateTime    @updatedAt
  updatedBy               String?     // memberId of who last updated
}
```

### API Endpoints

```typescript
// GET /api/settings/notifications - Get user's notification preferences
// PATCH /api/settings/notifications - Update user's preferences
// GET /api/settings/notifications/system - Get system settings (Founder only)
// PATCH /api/settings/notifications/system - Update system settings (Founder only)
```

### Implementation Files

**New Files:**
- `src/app/settings/NotificationsTab.tsx` - Client component
- `src/app/api/settings/notifications/route.ts` - GET, PATCH
- `src/app/api/settings/notifications/system/route.ts` - GET, PATCH (Founder)

**Modified Files:**
- `prisma/schema.prisma` - Add NotificationPreference, SystemNotificationSettings
- `src/app/settings/SettingsClient.tsx` - Import NotificationsTab
- `src/lib/notify.ts` - Check preferences before sending notifications

### UI Mockup Structure

```
┌─────────────────────────────────────────────┐
│ Notifications                                │
├─────────────────────────────────────────────┤
│ Your Notification Preferences                │
│                                              │
│ Project & Estimate Notifications             │
│ ┌─────────────────────────────────────────┐ │
│ │ ☑ Project assigned to you               │ │
│ │ ☑ Estimate requested from you           │ │
│ │ ☑ Estimate ready for your review        │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ QA & Delivery Notifications                  │
│ ┌─────────────────────────────────────────┐ │
│ │ ☑ QA test cycle failed                  │ │
│ │ ☑ QA test cycle passed                  │ │
│ │ ☑ Release signed off - ready to deliver │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ Deadline & Reminder Notifications            │
│ ┌─────────────────────────────────────────┐ │
│ │ ☑ Deadline approaching (24h warning)    │ │
│ │ ☑ Missing EOD reminder (8pm)            │ │
│ │ ☑ Missing morning plan (10am)           │ │
│ │ ☑ Weekly check-in due (Monday)          │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ [Save Preferences]                           │
│                                              │
│ ─────────────────────────────────────────── │
│                                              │
│ 🔒 System Settings (Founder Only)           │
│ ┌─────────────────────────────────────────┐ │
│ │ ☑ Enable notification system            │ │
│ │ Quiet hours: [22:00] to [07:00]         │ │
│ │ ☐ Send notifications on weekends        │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ [Save System Settings]                       │
└─────────────────────────────────────────────┘
```

### Test Scenarios

**TC-Notifications-001:** Update user notification preferences
**TC-Notifications-002:** Disable all notifications for user
**TC-Notifications-003:** Test quiet hours enforcement
**TC-Notifications-004:** Founder updates system settings
**TC-Notifications-005:** Verify notifications respect user preferences

---

## Tab 4: Workflow

### Purpose
Customize workflow statuses, templates, and defaults to match company processes.

### Features to Implement

#### 4.1 Project Status Customization
Allow customization of project statuses beyond defaults.

**Default Statuses:**
- Scoping
- Active
- QA
- Delivered
- Cancelled

**Custom Status Features:**
- Add new statuses (e.g., "Client Review", "On Hold", "Maintenance")
- Rename existing statuses
- Change status colors
- Define status transitions (which status can change to which)
- Archive unused statuses

#### 4.2 Estimation Templates
Pre-defined task breakdowns for common project types.

**Template Structure:**
- Template name (e.g., "E-commerce Website", "Mobile App", "API Integration")
- Default task breakdown with estimated hours
- Default buffer percentage
- Typical total hours range

**Example Template:**
```
Template: E-commerce Website
Buffer: 20%
Tasks:
  - Design / Homepage & Product Pages / 16h
  - Frontend / Product Catalog / 24h
  - Frontend / Shopping Cart / 16h
  - Backend / Payment Integration / 20h
  - Backend / Admin Panel / 24h
  - QA / Full Testing / 16h
Total: 116h + 20% = ~140h
```

#### 4.3 Default Settings
System-wide defaults for new items.

**Project Defaults:**
- Default project owner (dropdown)
- Default milestone duration (weeks)
- Auto-create QA milestone (yes/no)

**Estimation Defaults:**
- Default buffer % (10%, 15%, 20%, 25%)
- Default hourly rate (if not set in Company Profile)
- Auto-assign estimates to specific dev (optional)

**Daily Planning Defaults:**
- Morning plan deadline (time, default 9:30am)
- EOD deadline (time, default 7pm)
- Default task types shown in dropdown

**QA Defaults:**
- Required checklist items for sign-off
- Default test environment (staging/production)
- Auto-assign QA to specific member (optional)

#### 4.4 Workflow Automation (Future Enhancement)
- Auto-move project to QA when milestone complete
- Auto-notify BD when estimate sits for 3+ days
- Auto-create weekly check-in tasks
- Auto-archive old delivered projects

### Database Schema

```prisma
model ProjectStatus {
  id          String   @id @default(cuid())
  name        String   @unique
  color       String   // hex color code
  order       Int      // display order
  isDefault   Boolean  @default(false) // can't be deleted
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
}

model EstimationTemplate {
  id              String   @id @default(cuid())
  name            String
  description     String?
  bufferPct       Int      @default(20)
  tasks           Json     // Array of {category, task, hours}
  totalHours      Float
  createdBy       String   // memberId
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
}

model WorkflowDefaults {
  id                      String   @id @default(cuid())

  // Project defaults
  defaultProjectOwnerId   String?
  defaultMilestoneDuration Int     @default(2) // weeks
  autoCreateQAMilestone   Boolean  @default(true)

  // Estimation defaults
  defaultBufferPct        Int      @default(20)
  defaultHourlyRate       Float?

  // Daily planning defaults
  morningPlanDeadline     String   @default("09:30")
  eodDeadline             String   @default("19:00")

  // QA defaults
  defaultTestEnvironment  String   @default("staging")
  autoAssignQAToId        String?

  updatedAt               DateTime @updatedAt
  updatedBy               String?
}
```

### API Endpoints

```typescript
// Project Statuses
// GET /api/settings/workflow/statuses - List all statuses
// POST /api/settings/workflow/statuses - Create custom status
// PATCH /api/settings/workflow/statuses/[id] - Update status
// DELETE /api/settings/workflow/statuses/[id] - Archive status

// Estimation Templates
// GET /api/settings/workflow/templates - List templates
// POST /api/settings/workflow/templates - Create template
// PATCH /api/settings/workflow/templates/[id] - Update template
// DELETE /api/settings/workflow/templates/[id] - Delete template

// Defaults
// GET /api/settings/workflow/defaults - Get all defaults
// PATCH /api/settings/workflow/defaults - Update defaults
```

### Implementation Files

**New Files:**
- `src/app/settings/WorkflowTab.tsx` - Client component
- `src/app/api/settings/workflow/statuses/route.ts` - GET, POST
- `src/app/api/settings/workflow/statuses/[id]/route.ts` - PATCH, DELETE
- `src/app/api/settings/workflow/templates/route.ts` - GET, POST
- `src/app/api/settings/workflow/templates/[id]/route.ts` - PATCH, DELETE
- `src/app/api/settings/workflow/defaults/route.ts` - GET, PATCH

**Modified Files:**
- `prisma/schema.prisma` - Add ProjectStatus, EstimationTemplate, WorkflowDefaults
- `src/app/settings/SettingsClient.tsx` - Import WorkflowTab

### UI Mockup Structure

```
┌─────────────────────────────────────────────┐
│ Workflow Customization                       │
├─────────────────────────────────────────────┤
│                                              │
│ Project Statuses                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 🟦 Scoping          [Edit] [↑] [↓]      │ │
│ │ 🟩 Active           [Edit] [↑] [↓]      │ │
│ │ 🟨 QA               [Edit] [↑] [↓]      │ │
│ │ 🟪 Client Review    [Edit] [↑] [↓] [×]  │ │
│ │ ✅ Delivered        [Edit] [↑] [↓]      │ │
│ │ ⭕ Cancelled        [Edit] [↑] [↓]      │ │
│ │                                          │ │
│ │ [+ Add Custom Status]                    │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ Estimation Templates                         │
│ ┌─────────────────────────────────────────┐ │
│ │ 📄 E-commerce Website (140h)    [Edit]  │ │
│ │ 📱 Mobile App (200h)            [Edit]  │ │
│ │ 🔌 API Integration (60h)        [Edit]  │ │
│ │                                          │ │
│ │ [+ Create Template]                      │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ Default Settings                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Projects                                 │ │
│ │ • Default owner: [Vishal Sharma ▼]      │ │
│ │ • Milestone duration: [2 weeks]         │ │
│ │ • Auto-create QA milestone: ☑           │ │
│ │                                          │ │
│ │ Estimates                                │ │
│ │ • Default buffer: [20%]                 │ │
│ │ • Default rate: [$50/hour]              │ │
│ │                                          │ │
│ │ Daily Planning                           │ │
│ │ • Plan deadline: [09:30]                │ │
│ │ • EOD deadline: [19:00]                 │ │
│ │                                          │ │
│ │ QA                                       │ │
│ │ • Test environment: [Staging ▼]         │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ [Save All Settings]                          │
└─────────────────────────────────────────────┘
```

### Test Scenarios

**TC-Workflow-001:** Add custom project status
**TC-Workflow-002:** Reorder project statuses
**TC-Workflow-003:** Create estimation template
**TC-Workflow-004:** Update default settings
**TC-Workflow-005:** Delete custom status (verify projects using it)

---

## Implementation Priority

### Phase 1: Essential (Do First)
1. **Company Profile - Basic Info**
   - Company name, logo, currency
   - Estimated effort: 4-6 hours
   - Benefit: Professional branding

2. **Notifications - User Preferences**
   - Per-user notification toggles
   - Estimated effort: 6-8 hours
   - Benefit: Reduces notification fatigue

### Phase 2: Important (Do Second)
3. **Workflow - Default Settings**
   - Project, estimation, daily planning defaults
   - Estimated effort: 4-6 hours
   - Benefit: Streamlines daily operations

4. **Company Profile - Working Hours**
   - Business days, hours, timezone
   - Estimated effort: 4-5 hours
   - Benefit: Accurate deadline calculations

### Phase 3: Nice to Have (Do Later)
5. **Notifications - System Settings**
   - Quiet hours, weekend settings
   - Estimated effort: 3-4 hours
   - Benefit: Better notification timing

6. **Workflow - Custom Statuses**
   - Add/edit project statuses
   - Estimated effort: 6-8 hours
   - Benefit: Flexible workflow

7. **Workflow - Estimation Templates**
   - Pre-defined task breakdowns
   - Estimated effort: 6-8 hours
   - Benefit: Faster estimations

### Phase 4: Future Enhancements
8. **Company Profile - Public Holidays**
   - Holiday calendar management
   - Estimated effort: 4-5 hours

9. **Notifications - Email/Push**
   - Additional delivery channels
   - Estimated effort: 12-16 hours (requires email service setup)

10. **Workflow - Automation Rules**
    - Auto-transitions, auto-assignments
    - Estimated effort: 16-20 hours (complex logic)

---

## Total Estimated Effort

**Phase 1 (Essential):** 10-14 hours
**Phase 2 (Important):** 8-11 hours
**Phase 3 (Nice to Have):** 15-20 hours
**Phase 4 (Future):** 32-41 hours

**Minimum Viable Settings Module (Phase 1+2):** ~20-25 hours

---

## Testing Checklist

For each tab, ensure:
- ✅ Founder can access and modify settings
- ✅ Manager can access and modify settings
- ✅ Dev/BD/QA cannot access (redirect to home)
- ✅ Form validation works (required fields, data types)
- ✅ Error handling shows user-friendly messages
- ✅ Changes persist across page refreshes
- ✅ Changes reflect immediately in relevant modules
- ✅ Concurrent edits don't cause data corruption
- ✅ Default values load correctly for new installations

---

## Notes

1. **Data Migration:** If implementing custom statuses, need migration for existing projects
2. **Backward Compatibility:** Default statuses must remain for existing workflows
3. **Performance:** Settings should be cached, not queried on every page load
4. **Audit Trail:** Consider logging who changed what settings and when
5. **Validation:** Prevent deletion of statuses that have active projects using them

---

## Dependencies

**Before Starting:**
- Team Members tab fully tested ✅
- Database backup strategy in place
- Staging environment available for testing

**Required Libraries:**
- Image upload: Consider `next-image`, `sharp` for logo processing
- Rich text editor: `react-quill` or `tiptap` for email signature
- Date picker: `react-datepicker` for holiday calendar
- Color picker: `react-color` for status colors

**External Services (Future):**
- Email service: SendGrid, AWS SES, Resend (for email notifications)
- Image storage: AWS S3, Cloudinary (for logo uploads)

---

**End of Planning Document**
