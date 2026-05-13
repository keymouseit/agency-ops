# File Logging System

This application includes a comprehensive file logging system to help debug issues in production and development.

## Overview

The logging system writes logs to files in the `./logs` directory, organized by date and log level. Logs include timestamps, context data, and error stack traces.

## Setup

### 1. Enable File Logging

Add this to your `.env` file:

```bash
ENABLE_FILE_LOGGING="true"
```

### 2. Create Logs Directory (Optional)

The system will automatically create the `logs` directory if it doesn't exist. You can also create it manually:

```bash
mkdir logs
```

## Log Files

Logs are organized by date and level:

```
logs/
├── 2026-05-14-combined.log    # All log levels combined
├── 2026-05-14-debug.log       # Debug level only
├── 2026-05-14-info.log        # Info level only
├── 2026-05-14-warn.log        # Warnings only
└── 2026-05-14-error.log       # Errors only
```

## Log Levels

- **DEBUG**: Detailed diagnostic information (DB queries, internal state)
- **INFO**: General informational messages (API requests, successful operations)
- **WARN**: Warning messages (validation failures, deprecated usage)
- **ERROR**: Error messages with stack traces (exceptions, failures)

## Usage in Code

### Basic Logging

```typescript
import { logger } from '@/lib/logger'

// Debug message
logger.debug('Detailed diagnostic info', { userId: '123', operation: 'fetch' })

// Info message
logger.info('User logged in successfully', { userId: '123', ip: '192.168.1.1' })

// Warning
logger.warn('Invalid input received', { field: 'email', value: 'bad-email' })

// Error with stack trace
logger.error('Database connection failed', error, { operation: 'connect', retries: 3 })
```

### API Route Logging

```typescript
export async function POST(req: Request) {
  const startTime = Date.now()
  logger.logApiRequest('POST', '/api/team', userId)

  // ... your route logic ...

  logger.logApiResponse('POST', '/api/team', 200, Date.now() - startTime)
  return NextResponse.json(result)
}
```

### Database Query Logging

```typescript
const startTime = Date.now()
const users = await prisma.user.findMany()
logger.logDbQuery('findMany', 'user', Date.now() - startTime)
```

## Log Format

Each log entry includes:

```
[2026-05-14 10:30:45.123] [INFO] Creating team member
  Context: {
    "name": "John Doe",
    "email": "john@example.com",
    "role": "Dev"
  }
```

For errors:

```
[2026-05-14 10:30:45.456] [ERROR] User account creation failed
  Context: {
    "memberId": "cm5abc123"
  }
  Error: Unique constraint violation
  Stack: Error: Unique constraint violation
    at PrismaClient.create (/app/node_modules/@prisma/client/runtime/library.js:123:45)
    at POST (/app/src/app/api/team/route.ts:56:28)
```

## Examples from Production

### Team Member Creation Bug (BUG_044)

The logs will show:

```
[2026-05-14 10:30:45.123] [INFO] API POST /api/team
  Context: {
    "method": "POST",
    "path": "/api/team"
  }

[2026-05-14 10:30:45.234] [INFO] Creating team member
  Context: {
    "name": "Jane Smith",
    "email": "jane@example.com",
    "role": "QA"
  }

[2026-05-14 10:30:45.345] [INFO] Team member created successfully
  Context: {
    "memberId": "cm5xyz789",
    "name": "Jane Smith"
  }

[2026-05-14 10:30:45.456] [ERROR] User account creation failed
  Context: {
    "memberId": "cm5xyz789"
  }
  Error: Unique constraint failed on the constraint: `UserAccount_memberId_key`
  Stack: ...
```

This tells you:
1. The team member was created successfully
2. But the user account creation failed
3. The failure reason (unique constraint violation)

### QA Test Cycle Notification Bug (BUG_031)

The logs will show:

```
[2026-05-14 11:15:30.123] [INFO] Creating QA test cycle
  Context: {
    "projectId": "cm5proj123",
    "result": "pass",
    "conductedBy": "cm5qa456"
  }

[2026-05-14 11:15:30.234] [INFO] QA test cycle created successfully
  Context: {
    "cycleId": "cm5cycle789",
    "projectId": "cm5proj123",
    "result": "pass"
  }

[2026-05-14 11:15:30.345] [DEBUG] Sending QA test cycle notifications
  Context: {
    "projectId": "cm5proj123",
    "projectName": "Client Portal",
    "result": "pass",
    "ownerId": "cm5dev999"
  }

[2026-05-14 11:15:30.456] [INFO] Sending test_cycle_pass notification to project owner
  Context: {
    "projectId": "cm5proj123",
    "ownerId": "cm5dev999",
    "label": "pass"
  }

[2026-05-14 11:15:30.567] [DEBUG] Creating notifications
  Context: {
    "type": "test_cycle_pass",
    "memberIds": ["cm5dev999"],
    "message": "QA: Client Portal test cycle pass — great work!",
    "linkTo": "/qa/cm5proj123"
  }

[2026-05-14 11:15:30.678] [INFO] Notifications created successfully
  Context: {
    "type": "test_cycle_pass",
    "count": 1,
    "memberIds": ["cm5dev999"]
  }
```

This confirms:
1. The test cycle was created
2. Notifications were attempted
3. Notifications were created successfully
4. Who received the notifications

## Viewing Logs

### View All Logs for Today

```bash
cat logs/$(date +%Y-%m-%d)-combined.log
```

### View Only Errors

```bash
cat logs/$(date +%Y-%m-%d)-error.log
```

### Tail Live Logs

```bash
tail -f logs/$(date +%Y-%m-%d)-combined.log
```

### Search for Specific User/Request

```bash
grep "cm5xyz789" logs/$(date +%Y-%m-%d)-combined.log
```

### Search for API Errors

```bash
grep "ERROR.*API" logs/$(date +%Y-%m-%d)-combined.log
```

## Production Considerations

### Log Rotation

Logs are automatically organized by date. Old logs won't be automatically deleted, so you may want to set up a cron job to clean up old logs:

```bash
# Delete logs older than 30 days
find logs/ -name "*.log" -mtime +30 -delete
```

### Disk Space

Monitor disk space usage:

```bash
du -sh logs/
```

### Sensitive Data

The logger automatically truncates large request bodies (500 chars max) to prevent logging sensitive data. However, be careful not to log:
- Passwords or password hashes
- API keys or tokens
- Credit card numbers
- Personal identifying information (unless necessary)

## Troubleshooting

### Logs Not Being Created

1. Check that `ENABLE_FILE_LOGGING="true"` in your `.env` file
2. Verify the `logs` directory is writable:
   ```bash
   ls -la logs/
   ```
3. Check console output for file write errors

### Empty Log Files

- File logging only works on the server side (API routes, server components)
- Client-side code won't write to log files

### Too Many Log Files

Logs are created daily. If you see many files, it's because the app has been running for many days. This is normal. Set up log rotation if needed.

## Best Practices

1. **Log at appropriate levels**: Use DEBUG for diagnostic info, INFO for normal operations, WARN for recoverable issues, ERROR for failures
2. **Include context**: Always provide relevant context data (IDs, names, etc.)
3. **Don't log sensitive data**: Avoid passwords, tokens, personal info
4. **Log before and after critical operations**: Log entry/exit of important functions
5. **Log errors with stack traces**: Always pass the error object to `logger.error()`

## Additional Logging Locations

Logging has been added to these critical routes:
- `/api/team` - Team member creation
- `/api/team/[id]` - Team member updates
- `/api/qa/[id]/cycle` - QA test cycle creation and notifications
- `/lib/notify.ts` - Notification system

You can add logging to any other route by importing the logger and using the methods above.
