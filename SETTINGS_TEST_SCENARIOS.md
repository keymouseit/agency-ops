# Settings Module — QA Test Scenarios

**Module:** Settings
**Version:** v1.0
**Total test cases:** 20 (15 P1 + 5 P2)
**Access:** Founder and Manager roles only

---

## MODULE 15 — SETTINGS

### Navigation & Access

#### TC-Settings-001 · Settings icon visible for authorized roles [P1]
1. Log in as Founder (Shiven)
2. **Expect:** "⚙ Settings" link visible in navigation bar (last item)
3. Log in as Manager
4. **Expect:** Settings link visible
5. Log in as Dev/BD/QA
6. **Expect:** Settings link NOT visible

#### TC-Settings-002 · Access control enforcement [P1]
1. Log in as Dev (Vishal)
2. Manually navigate to `http://localhost:3000/settings`
3. **Expect:** Redirected to home page OR access denied message

#### TC-Settings-003 · Settings page loads [P1]
1. Log in as Founder
2. Click "⚙ Settings" in navigation
3. **Expect:** Page loads with 4 tabs visible: 👥 Team Members, 🏢 Company Profile, 🔔 Notifications, ⚙️ Workflow
4. **Expect:** Team Members tab active by default

---

### Team Members Tab

#### TC-Settings-004 · Team members list displays [P1]
1. Open Settings → Team Members tab
2. **Expect:** Table shows all team members from database
3. **Expect:** Columns: Name, Email, Role, Status, Actions
4. **Expect:** Members sorted by: Active first, then alphabetically by name

#### TC-Settings-005 · Member count statistics [P1]
1. On Team Members tab
2. **Expect:** 3 stat cards show:
   - Total Members (count matches table)
   - Active (green, matches count of active members)
   - Inactive (gray, matches count of inactive members)

#### TC-Settings-006 · Role badge colors [P1]
1. View team members list
2. **Expect:** Role badges display correct colors:
   - Founder → Purple
   - Manager → Indigo
   - BD → Blue
   - Dev → Green
   - QA → Teal
   - Both → Amber

#### TC-Settings-007 · Search/filter functionality [P1]
1. Enter "Vishal" in search box
2. **Expect:** Table filters to show only Vishal Sharma
3. Enter "dev" in search box
4. **Expect:** Shows all members with role "Dev"
5. Enter "example.com" (if any email contains it)
6. **Expect:** Filters by email domain
7. Clear search
8. **Expect:** All members shown again

#### TC-Settings-008 · Add new team member — success [P1]
1. Click "+ Add Member" button
2. **Expect:** Modal opens with form
3. Fill: Name = "Test User", Email = "test@example.com", Role = "Dev", Password = "test123", Active = checked
4. Click "Add Member"
5. **Expect:** Modal closes, page refreshes, new member appears in table
6. **Expect:** New member shows with Active status badge

#### TC-Settings-009 · Add member — duplicate email validation [P1]
1. Click "+ Add Member"
2. Fill with email that already exists in database (e.g., existing member's email)
3. Click "Add Member"
4. **Expect:** Error message: "A team member with this email already exists"
5. **Expect:** Modal stays open, form not cleared

#### TC-Settings-010 · Add member — required fields validation [P1]
1. Click "+ Add Member"
2. Leave Name blank, fill other fields
3. Try to submit
4. **Expect:** HTML5 validation prevents submission OR error shown
5. Fill Name, leave Email blank
6. **Expect:** Cannot submit
7. Fill Name and Email, leave Password blank
8. **Expect:** Cannot submit (password required for new members)

#### TC-Settings-011 · Edit existing member [P1]
1. Click "Edit" on any team member
2. **Expect:** Modal opens with form pre-filled
3. Change name to "Updated Name"
4. Leave password field blank
5. Click "Update Member"
6. **Expect:** Member name updated in table, password unchanged
7. **Expect:** Can still log in with old password

#### TC-Settings-012 · Edit member — change email [P1]
1. Click "Edit" on a member
2. Change email to a new unique email
3. Click "Update Member"
4. **Expect:** Email updated successfully
5. Log in with new email
6. **Expect:** Login works with new email

#### TC-Settings-013 · Edit member — change password [P1]
1. Click "Edit" on a member
2. Don't change name/email/role
3. Enter new password in password field
4. Click "Update Member"
5. **Expect:** Update successful
6. Log out, log in with that member's email and NEW password
7. **Expect:** Login successful
8. Try logging in with OLD password
9. **Expect:** Login fails

#### TC-Settings-014 · Edit member — email uniqueness [P1]
1. Click "Edit" on Member A
2. Try to change email to Member B's existing email
3. Click "Update Member"
4. **Expect:** Error: "A team member with this email already exists"

#### TC-Settings-015 · Deactivate team member [P1]
1. Find an active member, click "Deactivate"
2. **Expect:** Confirmation dialog appears
3. Click "OK"
4. **Expect:** Status badge changes to "Inactive" (gray)
5. **Expect:** Table row shows with reduced opacity
6. **Expect:** "Active" count decreases by 1, "Inactive" increases by 1
7. Try to log in as that deactivated member
8. **Expect:** Login fails or shows "Account deactivated" error

#### TC-Settings-016 · Reactivate team member [P1]
1. Find an inactive member, click "Activate"
2. **Expect:** Confirmation dialog appears
3. Click "OK"
4. **Expect:** Status badge changes to "Active" (green)
5. **Expect:** Row opacity returns to normal
6. **Expect:** "Active" count increases by 1
7. Log in as that member
8. **Expect:** Login successful

#### TC-Settings-017 · Form cancel behavior [P1]
1. Click "+ Add Member"
2. Fill some fields (don't submit)
3. Click "Cancel"
4. **Expect:** Modal closes, no data saved
5. Click "+ Add Member" again
6. **Expect:** Form is empty (previous input cleared)

#### TC-Settings-018 · Modal form persistence during error [P2]
1. Click "+ Add Member"
2. Fill all fields correctly except use duplicate email
3. Submit
4. **Expect:** Error shown, modal stays open, all fields still filled
5. Fix the email
6. Submit again
7. **Expect:** Success

#### TC-Settings-019 · Inactive members visual distinction [P2]
1. Deactivate 2-3 members
2. View team members table
3. **Expect:** Inactive members have reduced opacity (50%)
4. **Expect:** Inactive badge is gray
5. **Expect:** Active members have full opacity
6. **Expect:** Table maintains alternating row hover effect

#### TC-Settings-020 · Manager role can manage team [P1]
1. Log in as a Manager role user
2. Open Settings → Team Members
3. **Expect:** Can view all members
4. **Expect:** Can add new member
5. **Expect:** Can edit existing members
6. **Expect:** Can activate/deactivate members
7. Log in as Dev/BD/QA
8. **Expect:** Cannot access Settings at all

---

## Company Profile Tab

#### TC-Settings-021 · Placeholder visible [P2]
1. Click "🏢 Company Profile" tab
2. **Expect:** "Coming soon" message displayed
3. **Expect:** No errors in console

---

## Notifications Tab

#### TC-Settings-022 · Placeholder visible [P2]
1. Click "🔔 Notifications" tab
2. **Expect:** "Coming soon" message displayed
3. **Expect:** No errors in console

---

## Workflow Tab

#### TC-Settings-023 · Placeholder visible [P2]
1. Click "⚙️ Workflow" tab
2. **Expect:** "Coming soon" message displayed
3. **Expect:** No errors in console

---

## Integration Tests

#### TC-Settings-024 · Team member changes reflect in other modules [P2]
1. Add a new Dev member via Settings
2. Go to `/projects`, click "+ New project"
3. **Expect:** New member appears in Owner dropdown
4. Go to `/estimate`, create new estimation request
5. **Expect:** New member appears in "Assigned to" dropdown

#### TC-Settings-025 · Deactivated member restrictions [P1]
1. Create a project assigned to Member A
2. Deactivate Member A via Settings
3. Log in as Member A
4. **Expect:** Login fails OR shows access denied
5. Go to projects list (as Founder)
6. **Expect:** Member A's projects still visible (data not deleted)

---

## Edge Cases

#### TC-Settings-026 · Email case sensitivity [P2]
1. Create member with email "Test@Example.com"
2. Try to create another member with "test@example.com"
3. **Expect:** Should either:
   - Prevent duplicate (case-insensitive check) OR
   - Allow (case-sensitive check)
4. Document actual behavior

#### TC-Settings-027 · Long names/emails [P2]
1. Create member with 100-character name
2. **Expect:** Saves successfully, displays properly in table (truncate if needed)
3. Create member with very long email (e.g., 255 chars)
4. **Expect:** Handles gracefully (save or validation error)

#### TC-Settings-028 · Special characters in names [P2]
1. Create member with name containing apostrophe: "O'Brien"
2. **Expect:** Saves and displays correctly
3. Try name with emoji: "John 🎉 Doe"
4. **Expect:** Saves and displays correctly OR validation prevents

#### TC-Settings-029 · Concurrent edits [P2]
1. Founder opens edit modal for Member A
2. Manager (different browser) also edits Member A
3. Manager saves first
4. Founder saves after
5. **Expect:** Last write wins (Founder's changes overwrite Manager's)
6. **Expect:** No data corruption

#### TC-Settings-030 · Delete vs Deactivate [P1]
1. Verify that "Deactivate" only sets `active = false`
2. Check database (Prisma Studio)
3. **Expect:** Member record still exists
4. **Expect:** All related records (projects, check-ins, etc.) still linked
5. **Expect:** No "Delete" button exists (soft delete only)

---

## SIGN-OFF CHECKLIST

| Test Case Range | P1 Count | P2 Count | Status |
|----------------|----------|----------|--------|
| TC-Settings-001 to 020 | 15 | 5 | |
| TC-Settings-021 to 030 | 5 | 5 | |
| **TOTAL** | **20** | **10** | |

**QA Lead sign-off:** _________________________ Date: _____________

---

## BUGS FOUND (Template)

If bugs are found during testing, document here:

```
BUG-ID: BUG-Settings-001
TC-ID: [e.g., TC-Settings-009]
Title: [brief description]
Priority: P1 / P2 / P3
Tester: [name]
Date: [date]

Steps to reproduce:
1.
2.
3.

Expected: [what should happen]
Actual: [what happened]
Error message (if any): [exact text or screenshot]
Browser + version: [e.g., Chrome 124]
```
