# QA Test Cases - Audit & Logging Module

**Module:** Audit Logging System
**Created:** 2026-05-14
**Priority:** P1 (Critical - Security & Compliance)

---

## Test Coverage Overview

| Feature | Test Cases | Priority |
|---------|-----------|----------|
| File Logging System | 8 | P1 |
| Audit Log Creation | 12 | P1 |
| System-wide Audit Log Viewer | 10 | P1 |
| Entity-specific Audit Trails | 8 | P1 |
| Audit Log Security | 6 | P1 |
| **Total** | **44** | — |

---

## 1. FILE LOGGING SYSTEM

### TC-LOG-001: Enable File Logging
**Priority:** P1
**Preconditions:** `.env` file accessible

**Steps:**
1. Open `.env` file
2. Add `ENABLE_FILE_LOGGING="true"`
3. Restart the server: `npm run dev`
4. Perform any action (e.g., create a team member)
5. Check `logs/` directory exists
6. Verify today's log files are created

**Expected Result:**
- `logs/` directory created
- Files exist: `YYYY-MM-DD-combined.log`, `YYYY-MM-DD-info.log`, `YYYY-MM-DD-error.log`
- Logs contain entries with timestamps

**Status:** ⬜ Not Tested

---

### TC-LOG-002: Disable File Logging
**Priority:** P2

**Steps:**
1. Set `ENABLE_FILE_LOGGING="false"` in `.env`
2. Restart server
3. Perform actions
4. Check logs directory

**Expected Result:**
- No new log files created
- Existing log files not modified

**Status:** ⬜ Not Tested

---

### TC-LOG-003: Log Levels - INFO
**Priority:** P1

**Steps:**
1. Enable logging
2. Create a team member via `/api/team`
3. Open `YYYY-MM-DD-info.log`
4. Search for "Team member created"

**Expected Result:**
- Entry exists with `[INFO]` level
- Contains member ID and name
- Timestamp is accurate

**Status:** ⬜ Not Tested

---

### TC-LOG-004: Log Levels - ERROR
**Priority:** P1

**Steps:**
1. Enable logging
2. Try to create team member with duplicate email
3. Open `YYYY-MM-DD-error.log`
4. Search for error message

**Expected Result:**
- Entry exists with `[ERROR]` level
- Contains error message and stack trace
- Context includes attempted email

**Status:** ⬜ Not Tested

---

### TC-LOG-005: API Request Logging
**Priority:** P1

**Steps:**
1. Enable logging
2. Make API call to `/api/team` (POST)
3. Check combined log file
4. Search for "API POST /api/team"

**Expected Result:**
- Request logged with method and path
- Response logged with status code and duration
- Both entries have same timestamp sequence

**Status:** ⬜ Not Tested

---

### TC-LOG-006: Notification Logging
**Priority:** P1

**Steps:**
1. Enable logging
2. Submit a QA test cycle with "pass" result
3. Check combined log for "Creating notifications"
4. Verify "Notifications created successfully" entry

**Expected Result:**
- Notification creation attempt logged
- Success confirmation logged
- Shows recipient IDs and count

**Status:** ⬜ Not Tested

---

### TC-LOG-007: Log File Rotation by Date
**Priority:** P2

**Steps:**
1. Enable logging
2. Note today's log files
3. Wait until next day (or simulate by changing system date)
4. Perform action
5. Check logs directory

**Expected Result:**
- New log files created with new date
- Old log files preserved
- Both dates' logs are separate

**Status:** ⬜ Not Tested

---

### TC-LOG-008: Large Log Entry Truncation
**Priority:** P2

**Steps:**
1. Enable logging
2. Submit API request with very large body (>1000 chars)
3. Check log entry

**Expected Result:**
- Request body logged but truncated to 500 chars
- Indicates truncation occurred
- No performance impact

**Status:** ⬜ Not Tested

---

## 2. AUDIT LOG CREATION

### TC-AUDIT-001: Team Member Creation Audit
**Priority:** P1

**Steps:**
1. Log in as Founder
2. Navigate to Settings → Team Members
3. Create new team member: "Test User", "test@example.com", role "Dev"
4. Check database: `SELECT * FROM AuditLog WHERE entityType='TeamMember' ORDER BY timestamp DESC LIMIT 1`

**Expected Result:**
- Audit log entry exists
- `action` = "created"
- `entityType` = "TeamMember"
- `entityName` = "Test User"
- `userId` = Founder's ID
- `userName` and `userEmail` populated
- `timestamp` is accurate
- `ipAddress` captured (if available)

**Status:** ⬜ Not Tested

---

### TC-AUDIT-002: Team Member Role Change Audit
**Priority:** P1

**Steps:**
1. Log in as Founder
2. Edit existing team member
3. Change role from "Dev" to "QA"
4. Save changes
5. Check audit log

**Expected Result:**
- Audit entry created with `action` = "updated"
- `changes` JSON contains: `{"role": {"old": "Dev", "new": "QA"}}`
- No other fields in changes if only role changed

**Status:** ⬜ Not Tested

---

### TC-AUDIT-003: Team Member Deactivation Audit
**Priority:** P1

**Steps:**
1. Log in as Founder
2. Deactivate a team member
3. Check audit log

**Expected Result:**
- `action` = "deactivated"
- `changes` = `{"active": {"old": true, "new": false}}`
- Proper user attribution

**Status:** ⬜ Not Tested

---

### TC-AUDIT-004: Password Change Audit
**Priority:** P1 (Security)

**Steps:**
1. Log in as any user
2. Change password via Account settings
3. Check audit log for that user

**Expected Result:**
- Audit entry exists with `action` = "password_changed"
- `changes` field is NULL or empty (don't log password)
- User ID matches logged-in user
- IP address captured

**Status:** ⬜ Not Tested

---

### TC-AUDIT-005: Project Status Change Audit
**Priority:** P1

**Steps:**
1. Log in as Developer
2. Open a project in "Active" status
3. Change status to "QA"
4. Submit QA handoff information
5. Check audit log

**Expected Result:**
- `action` = "status_changed"
- `entityType` = "Project"
- `changes` = `{"status": {"old": "active", "new": "qa"}}`
- `metadata` contains QA handoff details
- Timestamp matches action time

**Status:** ⬜ Not Tested

---

### TC-AUDIT-006: Project Delivered Audit
**Priority:** P1

**Steps:**
1. Log in as Developer
2. Complete QA sign-off for project
3. Change project status to "Delivered"
4. Check audit log

**Expected Result:**
- Audit entry created
- `metadata` includes `deliveredWithSignOff: true`
- `changes` shows status change to "delivered"
- `actualEnd` timestamp captured

**Status:** ⬜ Not Tested

---

### TC-AUDIT-007: QA Test Cycle Audit
**Priority:** P1

**Steps:**
1. Log in as QA
2. Submit test cycle with result "pass"
3. Check audit log for TestCycle entity

**Expected Result:**
- `action` = "submitted"
- `entityType` = "TestCycle"
- `entityName` = project name
- `metadata` includes: result, cycleType, environment
- `userId` = QA user who submitted

**Status:** ⬜ Not Tested

---

### TC-AUDIT-008: QA Release Sign-off Audit
**Priority:** P1

**Steps:**
1. Log in as QA
2. Submit release sign-off for project
3. Enter quality score and checklist
4. Check audit log

**Expected Result:**
- `action` = "signed_off"
- `entityType` = "ReleaseSignOff"
- `metadata` includes qualityScore, cycleId, allChecksPassed
- Project name in entityName

**Status:** ⬜ Not Tested

---

### TC-AUDIT-009: Multiple Changes in One Action
**Priority:** P2

**Steps:**
1. Edit team member
2. Change both name AND role simultaneously
3. Save
4. Check audit log entry

**Expected Result:**
- Single audit entry created
- `changes` contains both fields:
  ```json
  {
    "name": {"old": "Old Name", "new": "New Name"},
    "role": {"old": "Dev", "new": "QA"}
  }
  ```

**Status:** ⬜ Not Tested

---

### TC-AUDIT-010: System Action (No User)
**Priority:** P2

**Steps:**
1. Trigger automated action (e.g., cron job)
2. Check audit log

**Expected Result:**
- `userId` = NULL
- `userName` = NULL or "System"
- Action still logged correctly

**Status:** ⬜ Not Tested

---

### TC-AUDIT-011: Concurrent Audit Logs
**Priority:** P2

**Steps:**
1. Have 2 users logged in simultaneously
2. User A: Create team member
3. User B: Change project status (at same time)
4. Check audit logs

**Expected Result:**
- Both audit entries created
- No data loss or corruption
- Correct user attribution for each
- Timestamps accurate for both

**Status:** ⬜ Not Tested

---

### TC-AUDIT-012: Audit Log on Failed Action
**Priority:** P2

**Steps:**
1. Attempt to create team member with validation error
2. Check if audit log is created

**Expected Result:**
- No audit log created for failed validation
- Audit logs only created for successful state changes
- Error logged to file logs but not audit log

**Status:** ⬜ Not Tested

---

## 3. SYSTEM-WIDE AUDIT LOG VIEWER

### TC-VIEWER-001: Access Audit Log as Founder
**Priority:** P1

**Steps:**
1. Log in as Founder
2. Navigate to `/settings/audit-log`

**Expected Result:**
- Page loads successfully
- Shows list of audit entries
- Pagination controls visible
- Filter options displayed

**Status:** ⬜ Not Tested

---

### TC-VIEWER-002: Access Denied for Non-Founder
**Priority:** P1 (Security)

**Steps:**
1. Log in as Developer
2. Try to navigate to `/settings/audit-log`

**Expected Result:**
- Access denied (redirect to home or 403 error)
- Cannot view system-wide audit logs
- Security message displayed

**Status:** ⬜ Not Tested

---

### TC-VIEWER-003: Filter by User
**Priority:** P1

**Steps:**
1. Log in as Founder
2. Navigate to audit log viewer
3. Select specific user from "User" dropdown
4. Click "Apply Filters"

**Expected Result:**
- Only logs for selected user displayed
- Count updates to match filtered results
- Pagination resets to page 1

**Status:** ⬜ Not Tested

---

### TC-VIEWER-004: Filter by Entity Type
**Priority:** P1

**Steps:**
1. Open audit log viewer
2. Select "Project" from Entity Type dropdown
3. Apply filters

**Expected Result:**
- Only Project-related logs shown
- All entries have entityType = "Project"
- Other entity types not visible

**Status:** ⬜ Not Tested

---

### TC-VIEWER-005: Filter by Action
**Priority:** P1

**Steps:**
1. Open audit log viewer
2. Select "status_changed" from Action dropdown
3. Apply filters

**Expected Result:**
- Only status change logs displayed
- All entries have action = "status_changed"
- Badge colors match action type

**Status:** ⬜ Not Tested

---

### TC-VIEWER-006: Date Range Filter
**Priority:** P1

**Steps:**
1. Open audit log viewer
2. Select "Last 7 days" from Date Range
3. Apply filters

**Expected Result:**
- Only logs from past 7 days shown
- Older entries not visible
- Count reflects filtered range

**Status:** ⬜ Not Tested

---

### TC-VIEWER-007: Search Functionality
**Priority:** P1

**Steps:**
1. Open audit log viewer
2. Enter search term in Search box (e.g., "Test User")
3. Click "Apply Filters"

**Expected Result:**
- Only entries matching search term displayed
- Searches across entityName, userName, userEmail
- Case-insensitive search

**Status:** ⬜ Not Tested

---

### TC-VIEWER-008: Pagination
**Priority:** P2

**Steps:**
1. Open audit log viewer
2. Note page 1 entries
3. Click "Next" button
4. Check page 2 entries

**Expected Result:**
- Page 2 loads with different entries
- Page indicator shows "Page 2 of X"
- Previous button now enabled
- No duplicate entries across pages

**Status:** ⬜ Not Tested

---

### TC-VIEWER-009: View Details Modal
**Priority:** P1

**Steps:**
1. Open audit log viewer
2. Click "View" on any entry
3. Inspect modal content

**Expected Result:**
- Modal opens with full details
- Shows timestamp, user, action, entity
- Changes displayed in old→new format
- Metadata shown as formatted JSON
- IP address visible
- Close button works

**Status:** ⬜ Not Tested

---

### TC-VIEWER-010: Export to CSV
**Priority:** P2

**Steps:**
1. Open audit log viewer
2. Apply some filters
3. Click "Export to CSV"
4. Check downloaded file

**Expected Result:**
- CSV file downloads successfully
- Filename includes date (e.g., audit-log-2026-05-14.csv)
- Contains headers: Timestamp, User, Email, Action, Entity Type, Entity Name, Changes, IP Address
- All visible entries included (respects current filters)
- Changes column shows JSON

**Status:** ⬜ Not Tested

---

## 4. ENTITY-SPECIFIC AUDIT TRAILS

### TC-ENTITY-001: Project History Display
**Priority:** P1

**Steps:**
1. Log in as any user
2. Navigate to a project detail page (`/projects/[id]`)
3. Scroll to "Project History" section

**Expected Result:**
- Audit trail component visible
- Shows recent changes to this project
- Timeline format with dots
- Action badges color-coded
- "Details" button on each entry

**Status:** ⬜ Not Tested

---

### TC-ENTITY-002: Lead Activity History Display
**Priority:** P1

**Steps:**
1. Navigate to lead detail page (`/pipeline/[id]`)
2. Check for "Lead Activity History" section

**Expected Result:**
- Audit trail visible
- Shows lead-specific changes only
- No entries from other leads

**Status:** ⬜ Not Tested

---

### TC-ENTITY-003: QA History Display
**Priority:** P1

**Steps:**
1. Navigate to QA project page (`/qa/[id]`)
2. Find "QA & Project History" section

**Expected Result:**
- Shows test cycles and sign-offs
- Project status changes visible
- QA-specific metadata displayed

**Status:** ⬜ Not Tested

---

### TC-ENTITY-004: Expand/Collapse Audit Trail
**Priority:** P2

**Steps:**
1. Open project detail page with >5 audit entries
2. Check initial display (should show 5)
3. Click "Show X more..."
4. Click "Show less"

**Expected Result:**
- Initially shows 5 entries
- "Show X more" button visible if >5 entries exist
- Clicking expands to show all
- "Show less" collapses back to 5

**Status:** ⬜ Not Tested

---

### TC-ENTITY-005: Entity Audit Detail Modal
**Priority:** P1

**Steps:**
1. On project page, click "Details" on an audit entry
2. View modal

**Expected Result:**
- Modal shows full change details
- Old vs New values side-by-side
- Color coding: red for old, green for new
- Metadata formatted properly

**Status:** ⬜ Not Tested

---

### TC-ENTITY-006: No History Message
**Priority:** P2

**Steps:**
1. Create brand new project
2. View project detail page immediately
3. Check audit trail section

**Expected Result:**
- Shows "No changes recorded yet" message
- Section still visible but empty
- No errors

**Status:** ⬜ Not Tested

---

### TC-ENTITY-007: Access Control - Entity Trail
**Priority:** P1

**Steps:**
1. Log in as Developer
2. View own project's audit trail
3. Try to view another dev's project audit trail

**Expected Result:**
- Can see audit trail for accessible projects
- Access control follows existing project permissions
- Cannot see trails for unauthorized projects

**Status:** ⬜ Not Tested

---

### TC-ENTITY-008: Real-time Update After Change
**Priority:** P2

**Steps:**
1. Open project detail page
2. Change project status
3. Stay on same page (don't refresh)
4. Check audit trail

**Expected Result:**
- After status change, page refreshes
- New audit entry visible in history
- Appears at top of list

**Status:** ⬜ Not Tested

---

## 5. AUDIT LOG SECURITY

### TC-SEC-001: Immutability - No Edit
**Priority:** P1 (Security)

**Steps:**
1. Access database directly
2. Try to UPDATE an existing audit log entry
3. Check if edit is prevented

**Expected Result:**
- (If possible) Database constraint prevents edit
- Or: Application logic prevents edit
- Audit logs are append-only

**Status:** ⬜ Not Tested

---

### TC-SEC-002: Immutability - No Delete
**Priority:** P1 (Security)

**Steps:**
1. Access database directly
2. Try to DELETE an audit log entry
3. Check if delete is prevented

**Expected Result:**
- (If possible) Database constraint prevents delete
- Or: Application logic prevents delete
- Historical records preserved

**Status:** ⬜ Not Tested

---

### TC-SEC-003: Sensitive Data Not Logged
**Priority:** P1 (Security/Privacy)

**Steps:**
1. Change user password
2. Check audit log entry
3. Inspect changes and metadata fields

**Expected Result:**
- Password NOT stored in audit log
- Password hash NOT stored
- Only action "password_changed" logged
- No sensitive data exposed

**Status:** ⬜ Not Tested

---

### TC-SEC-004: User Deletion Handling
**Priority:** P1

**Steps:**
1. Create audit entry (user A makes change)
2. Delete user A from system
3. View audit log entry

**Expected Result:**
- Audit entry still exists
- `userName` and `userEmail` preserved (copied at creation time)
- `userId` may be null or broken reference but log remains
- Historical attribution intact

**Status:** ⬜ Not Tested

---

### TC-SEC-005: IP Address Logging
**Priority:** P2 (Security)

**Steps:**
1. Make change from known IP address
2. Check audit log entry

**Expected Result:**
- IP address captured in `ipAddress` field
- Accurate IP (not proxy/CDN IP if possible)
- X-Forwarded-For respected

**Status:** ⬜ Not Tested

---

### TC-SEC-006: User Agent Logging
**Priority:** P2

**Steps:**
1. Make change from browser
2. Check audit log entry

**Expected Result:**
- User agent string captured
- Shows browser and OS info
- Useful for security analysis

**Status:** ⬜ Not Tested

---

## Test Execution Summary

**Total Test Cases:** 44
**Priority P1 (Critical):** 38 cases
**Priority P2 (Important):** 6 cases

### Coverage by Feature:
- File Logging: 8 tests
- Audit Creation: 12 tests
- Audit Viewer: 10 tests
- Entity Trails: 8 tests
- Security: 6 tests

### Recommended Test Order:
1. File logging setup (TC-LOG-001 to TC-LOG-004)
2. Audit log creation (TC-AUDIT-001 to TC-AUDIT-008)
3. Viewer functionality (TC-VIEWER-001 to TC-VIEWER-010)
4. Entity trails (TC-ENTITY-001 to TC-ENTITY-008)
5. Security validation (TC-SEC-001 to TC-SEC-006)

---

## Bug Reporting Template

If a test fails, report using this format:

```
**Test Case:** TC-XXX-YYY
**Status:** ❌ Failed
**Environment:** Dev/Staging/Prod
**Steps Taken:** [List actual steps]
**Expected:** [What should happen]
**Actual:** [What actually happened]
**Screenshots:** [If applicable]
**Logs:** [Relevant log entries]
**Severity:** Critical/High/Medium/Low
**Priority:** P0/P1/P2/P3
```

---

**End of Test Cases**
