import nodemailer from 'nodemailer'
import { google } from 'googleapis'
import { LeaveRequest, TeamMember } from '@prisma/client'
import { formatIstDate, formatIstLeaveRange, istDateInputValue, istNextDateInputValue } from '@/lib/ist'
import { leaveTypeLabel } from '@/lib/leave-today'
import { getNotificationEmails } from '@/lib/notification-emails'

type LeaveWithMember = LeaveRequest & { member: TeamMember }

function calendarTargetEmail() {
  return (process.env.GOOGLE_CALENDAR_ID || process.env.SMTP_USER || '').trim()
}

async function calendarTargetEmails() {
  const fromSettings = await getNotificationEmails('leave_calendar')
  if (fromSettings.length) return fromSettings
  const fallback = calendarTargetEmail()
  return fallback ? [fallback] : []
}

function leaveCalendarUid(leaveId: string) {
  return `leave-${leaveId}@agency-ops`
}

function leaveCalendarApiEventId(leaveId: string) {
  return `leave${leaveId.replace(/[^a-z0-9]/gi, '').toLowerCase()}`
}

function leaveEventSummary(leave: LeaveWithMember) {
  return `${leave.member.name} — ${leaveTypeLabel(leave.leaveType, leave.timeSlot)}`
}

function leaveEventDescription(leave: LeaveWithMember) {
  const dates = formatIstLeaveRange(leave.startDate, leave.endDate)
  const reason = leave.reason?.trim() || 'N/A'
  return `Dates: ${dates}\nType: ${leaveTypeLabel(leave.leaveType, leave.timeSlot)}\nReason: ${reason}\nStatus: Approved`
}

function icsEscape(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function icsStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function toIcsDate(yyyyMmDd: string) {
  return yyyyMmDd.replace(/-/g, '')
}

function hasGoogleApiCredentials() {
  if (process.env.GOOGLE_CREDENTIALS_BASE64?.trim()) return true
  return Boolean(process.env.GOOGLE_CLIENT_EMAIL?.trim() && process.env.GOOGLE_PRIVATE_KEY?.trim())
}

function googleAuth() {
  const credentialsBase64 = process.env.GOOGLE_CREDENTIALS_BASE64?.trim()
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  return credentialsBase64
    ? new google.auth.GoogleAuth({
        credentials: JSON.parse(Buffer.from(credentialsBase64, 'base64').toString('utf-8')),
        scopes: ['https://www.googleapis.com/auth/calendar.events'],
      })
    : new google.auth.GoogleAuth({
        credentials: { client_email: clientEmail, private_key: privateKey },
        scopes: ['https://www.googleapis.com/auth/calendar.events'],
      })
}

function mailer() {
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  if (!smtpUser || !smtpPass) return null
  return {
    smtpUser,
    transporter: nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    }),
  }
}

function buildLeaveIcs(
  leave: LeaveWithMember,
  organizerEmail: string,
  attendeeEmail: string,
  method: 'REQUEST' | 'CANCEL',
) {
  const uid = leaveCalendarUid(leave.id)
  const start = toIcsDate(istDateInputValue(leave.startDate))
  const end = toIcsDate(istNextDateInputValue(leave.endDate))
  const stamp = icsStamp()
  const summary = icsEscape(leaveEventSummary(leave))
  const description = icsEscape(leaveEventDescription(leave))
  const transp = leave.leaveType === 'work_from_home' ? 'TRANSPARENT' : 'OPAQUE'
  const status = method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'
  const sequence = method === 'CANCEL' ? '1' : '0'

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Agency Ops//Leave//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `ORGANIZER;CN=Agency Ops:mailto:${organizerEmail}`,
    `ATTENDEE;CN=Leave calendar;RSVP=FALSE;PARTSTAT=ACCEPTED;ROLE=REQ-PARTICIPANT:mailto:${attendeeEmail}`,
    `STATUS:${status}`,
    `TRANSP:${transp}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

async function insertViaGoogleApi(leave: LeaveWithMember, calendarId: string) {
  const calendar = google.calendar({ version: 'v3', auth: googleAuth() })
  const response = await calendar.events.insert({
    calendarId,
    requestBody: {
      id: leaveCalendarApiEventId(leave.id),
      summary: leaveEventSummary(leave),
      description: leaveEventDescription(leave),
      start: { date: istDateInputValue(leave.startDate) },
      end: { date: istNextDateInputValue(leave.endDate) },
      transparency: leave.leaveType === 'work_from_home' ? 'transparent' : 'opaque',
    },
  })
  console.log(`Google Calendar event created: ${response.data.htmlLink}`)
  return response.data
}

async function deleteViaGoogleApi(leave: LeaveWithMember, calendarId: string) {
  const calendar = google.calendar({ version: 'v3', auth: googleAuth() })
  await calendar.events.delete({
    calendarId,
    eventId: leaveCalendarApiEventId(leave.id),
    sendUpdates: 'all',
  })
  console.log(`Google Calendar event deleted for leave ${leave.id}`)
}

async function sendCalendarMail(
  leave: LeaveWithMember,
  calendarEmail: string,
  method: 'REQUEST' | 'CANCEL',
) {
  const mail = mailer()
  if (!mail) {
    console.log('Leave calendar email skipped: SMTP is not configured.')
    return null
  }

  const ics = buildLeaveIcs(leave, mail.smtpUser, calendarEmail, method)
  const dates = formatIstLeaveRange(leave.startDate, leave.endDate)
  const type = leaveTypeLabel(leave.leaveType, leave.timeSlot)
  const cancelled = method === 'CANCEL'

  await mail.transporter.sendMail({
    from: `"Agency Ops" <${mail.smtpUser}>`,
    to: calendarEmail,
    subject: cancelled
      ? `Cancelled: ${leave.member.name} — ${type} (${dates})`
      : `Leave calendar: ${leave.member.name} — ${type} (${dates})`,
    text: cancelled
      ? `${leaveEventDescription(leave)}\n\nThis leave was cancelled, so the calendar event should be removed.`
      : `${leaveEventDescription(leave)}\n\nThis invite was added because the leave was approved.`,
    icalEvent: {
      method,
      filename: cancelled ? 'leave-cancelled.ics' : 'leave.ics',
      content: ics,
    },
  })

  console.log(
    `Leave calendar ${cancelled ? 'cancel' : 'invite'} sent to ${calendarEmail} for ${formatIstDate(leave.startDate)}`,
  )
  return { via: 'ics', to: calendarEmail, method }
}

export async function addEventToGoogleCalendar(leave: LeaveWithMember) {
  try {
    const calendarIds = await calendarTargetEmails()
    if (!calendarIds.length) {
      console.log('Leave calendar skipped: no calendar emails configured.')
      return null
    }

    if (hasGoogleApiCredentials()) {
      return await insertViaGoogleApi(leave, calendarIds[0])
    }

    for (const calendarId of calendarIds) {
      await sendCalendarMail(leave, calendarId, 'REQUEST')
    }
    return { via: 'ics', to: calendarIds }
  } catch (error) {
    console.error('Error adding leave to Google Calendar:', error)
    return null
  }
}

export async function removeEventFromGoogleCalendar(leave: LeaveWithMember) {
  try {
    const calendarIds = await calendarTargetEmails()
    if (!calendarIds.length) {
      console.log('Leave calendar cancel skipped: no calendar emails configured.')
      return null
    }

    if (hasGoogleApiCredentials()) {
      try {
        await deleteViaGoogleApi(leave, calendarIds[0])
        return { via: 'api' }
      } catch (error) {
        console.error('Google Calendar API delete failed, sending cancel invite instead:', error)
      }
    }

    for (const calendarId of calendarIds) {
      await sendCalendarMail(leave, calendarId, 'CANCEL')
    }
    return { via: 'ics', to: calendarIds }
  } catch (error) {
    console.error('Error removing leave from Google Calendar:', error)
    return null
  }
}
