import fs from 'fs'
import path from 'path'
import { format } from 'date-fns'

// Log levels
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, any>
  error?: Error
}

class Logger {
  private logsDir: string
  private enabled: boolean

  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs')
    this.enabled = process.env.ENABLE_FILE_LOGGING === 'true'

    // Create logs directory if it doesn't exist
    if (this.enabled && !fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true })
    }
  }

  private getLogFileName(level: LogLevel): string {
    const date = format(new Date(), 'yyyy-MM-dd')
    return path.join(this.logsDir, `${date}-${level.toLowerCase()}.log`)
  }

  private formatLogEntry(entry: LogEntry): string {
    let logLine = `[${entry.timestamp}] [${entry.level}] ${entry.message}`

    if (entry.context && Object.keys(entry.context).length > 0) {
      logLine += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`
    }

    if (entry.error) {
      logLine += `\n  Error: ${entry.error.message}`
      if (entry.error.stack) {
        logLine += `\n  Stack: ${entry.error.stack}`
      }
    }

    return logLine + '\n'
  }

  private writeLog(level: LogLevel, message: string, context?: Record<string, any>, error?: Error) {
    if (!this.enabled) return

    const entry: LogEntry = {
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS'),
      level,
      message,
      context,
      error,
    }

    const logLine = this.formatLogEntry(entry)
    const fileName = this.getLogFileName(level)

    try {
      fs.appendFileSync(fileName, logLine)

      // Also write to combined log
      const combinedFile = path.join(this.logsDir, `${format(new Date(), 'yyyy-MM-dd')}-combined.log`)
      fs.appendFileSync(combinedFile, logLine)
    } catch (err) {
      console.error('Failed to write log:', err)
    }

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      const consoleMethod = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'
      console[consoleMethod](`[${entry.timestamp}] [${level}]`, message, context || '', error || '')
    }
  }

  debug(message: string, context?: Record<string, any>) {
    this.writeLog('DEBUG', message, context)
  }

  info(message: string, context?: Record<string, any>) {
    this.writeLog('INFO', message, context)
  }

  warn(message: string, context?: Record<string, any>) {
    this.writeLog('WARN', message, context)
  }

  error(message: string, error?: Error, context?: Record<string, any>) {
    this.writeLog('ERROR', message, context, error)
  }

  // Utility method to log API requests
  logApiRequest(method: string, path: string, userId?: string, body?: any) {
    this.info(`API ${method} ${path}`, {
      method,
      path,
      userId,
      body: body ? JSON.stringify(body).substring(0, 500) : undefined, // Truncate large bodies
    })
  }

  // Utility method to log API responses
  logApiResponse(method: string, path: string, status: number, duration?: number) {
    const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO'
    this.writeLog(level, `API ${method} ${path} - ${status}`, {
      method,
      path,
      status,
      duration: duration ? `${duration}ms` : undefined,
    })
  }

  // Utility method to log database queries
  logDbQuery(operation: string, model: string, duration?: number) {
    this.debug(`DB ${operation} on ${model}`, {
      operation,
      model,
      duration: duration ? `${duration}ms` : undefined,
    })
  }
}

// Export singleton instance
export const logger = new Logger()
