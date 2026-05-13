# Logging Quick Start Guide

## Enable Logging (1 minute)

1. Open `.env` file and add:
   ```bash
   ENABLE_FILE_LOGGING="true"
   ```

2. Restart your dev server:
   ```bash
   npm run dev
   ```

3. Logs will be created in `./logs/` directory automatically

## View Today's Logs

```bash
# All logs
cat logs/$(date +%Y-%m-%d)-combined.log

# Just errors
cat logs/$(date +%Y-%m-%d)-error.log

# Live tail (watch in real-time)
tail -f logs/$(date +%Y-%m-%d)-combined.log
```

## Common Debugging Scenarios

### Debug BUG_044 (Team Member Creation Error)

1. Try creating a team member in the UI
2. Check logs:
   ```bash
   grep "team member" logs/$(date +%Y-%m-%d)-combined.log -A 5
   ```

You'll see:
- Whether the team member was created
- If user account creation failed
- The exact error message

### Debug BUG_031 (Missing Notifications)

1. Submit a QA test cycle with "pass" result
2. Check logs:
   ```bash
   grep "test_cycle_pass" logs/$(date +%Y-%m-%d)-combined.log -A 3
   ```

You'll see:
- If notifications were attempted
- Who should receive them
- If they were created successfully
- Any errors

### Find All Errors

```bash
cat logs/$(date +%Y-%m-%d)-error.log
```

### Search for Specific User Activity

```bash
grep "memberId123" logs/$(date +%Y-%m-%d)-combined.log
```

### Search for API Route Errors

```bash
grep "API.*ERROR" logs/$(date +%Y-%m-%d)-combined.log
```

## What's Being Logged

### API Routes with Full Logging:
✅ `/api/team` - Team member creation
✅ `/api/team/[id]` - Team member updates
✅ `/api/qa/[id]/cycle` - QA test cycles & notifications
✅ `/api/notifications` - Notification fetching
✅ Notification system (`notify()` function)

### What Gets Logged:
- Every API request (method, path, user)
- Every API response (status code, duration)
- Team member creation steps
- QA test cycle creation
- Notification sending (who, what, when)
- All errors with stack traces
- Database operations

## Log File Structure

```
logs/
├── 2026-05-14-combined.log    # Everything (use this for debugging)
├── 2026-05-14-error.log       # Only errors (check this first)
├── 2026-05-14-warn.log        # Warnings
├── 2026-05-14-info.log        # Info messages
└── 2026-05-14-debug.log       # Debug details
```

## Example Log Output

```
[2026-05-14 10:30:45.123] [INFO] API POST /api/team
  Context: {
    "method": "POST",
    "path": "/api/team"
  }

[2026-05-14 10:30:45.234] [INFO] Creating team member
  Context: {
    "name": "John Doe",
    "email": "john@example.com",
    "role": "Dev"
  }

[2026-05-14 10:30:45.345] [INFO] Team member created successfully
  Context: {
    "memberId": "cm5abc123",
    "name": "John Doe"
  }

[2026-05-14 10:30:45.456] [ERROR] User account creation failed
  Context: {
    "memberId": "cm5abc123"
  }
  Error: Unique constraint violation
  Stack: Error: Unique constraint violation
    at PrismaClient.create (...)
```

## Tips

1. **Start with error logs**: `cat logs/$(date +%Y-%m-%d)-error.log`
2. **Use grep to filter**: `grep "keyword" logs/*.log`
3. **Watch live**: `tail -f logs/$(date +%Y-%m-%d)-combined.log`
4. **Search by ID**: Most logs include IDs (memberId, projectId, etc.)

## Clean Up Old Logs

```bash
# Delete logs older than 7 days
find logs/ -name "*.log" -mtime +7 -delete
```

## Need More Details?

See [LOGGING.md](./LOGGING.md) for the complete documentation.
