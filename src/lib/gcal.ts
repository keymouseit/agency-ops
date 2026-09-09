import nodemailer from 'nodemailer'
import { google } from 'googleapis'
import { LeaveRequest, TeamMember } from '@prisma/client'
import { formatIstDate, formatIstLeaveRange, istDateInputValue, istNextDateInputValue } from '@/lib/ist'
import { leaveTypeLabel } from '@/lib/leave-today'

type LeaveWithMember = LeaveRequest & { member: TeamMember }

function calendarTargetEmail() {
  return (process.env.GOOGLE_CALENDAR_ID || process.env.SMTP_USER || '').trim()
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

async function insertViaGoogleApi(leave: LeaveWithMember, calendarId: string) {
  const credentialsBase64 = process.env.GOOGLE_CREDENTIALS_BASE64?.trim()
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  const auth = credentialsBase64
    ? new google.auth.GoogleAuth({
        credentials: JSON.parse(Buffer.from(credentialsBase64, 'base64').toString('utf-8')),
        scopes: ['https://www.googleapis.com/auth/calendar.events'],
      })
    : new google.auth.GoogleAuth({
        credentials: { client_email: clientEmail, private_key: privateKey },
        scopes: ['https://www.googleapis.com/auth/calendar.events'],
      })

  const calendar = google.calendar({ version: 'v3', auth })
  const response = await calendar.events.insert({
    calendarId,
    requestBody: {
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

function buildLeaveInviteIcs(leave: LeaveWithMember, organizerEmail: string, attendeeEmail: string) {
  const uid = `leave-${leave.id}@agency-ops`
  const start = toIcsDate(istDateInputValue(leave.startDate))
  const end = toIcsDate(istNextDateInputValue(leave.endDate))
  const stamp = icsStamp()
  const summary = icsEscape(leaveEventSummary(leave))
  const description = icsEscape(leaveEventDescription(leave))
  const transp = leave.leaveType === 'work_from_home' ? 'TRANSPARENT' : 'OPAQUE'

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Agency Ops//Leave//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `ORGANIZER;CN=Agency Ops:mailto:${organizerEmail}`,
    `ATTENDEE;CN=Leave calendar;RSVP=FALSE;PARTSTAT=ACCEPTED;ROLE=REQ-PARTICIPANT:mailto:${attendeeEmail}`,
    'STATUS:CONFIRMED',
    `TRANSP:${transp}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

async function sendCalendarInvite(leave: LeaveWithMember, calendarEmail: string) {
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  if (!smtpUser || !smtpPass) {
    console.log('Leave calendar invite skipped: SMTP is not configured.')
    return null
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
  })

  const ics = buildLeaveInviteIcs(leave, smtpUser, calendarEmail)
  const dates = formatIstLeaveRange(leave.startDate, leave.endDate)
  const type = leaveTypeLabel(leave.leaveType, leave.timeSlot)

  await transporter.sendMail({
    from: `"Agency Ops" <${smtpUser}>`,
    to: calendarEmail,
    subject: `Leave calendar: ${leave.member.name} — ${type} (${dates})`,
    text: `${leaveEventDescription(leave)}\n\nThis invite was added because the leave was approved.`,
    icalEvent: {
      method: 'REQUEST',
      filename: 'leave.ics',
      content: ics,
    },
  })

  console.log(`Leave calendar invite sent to ${calendarEmail} for ${formatIstDate(leave.startDate)}`)
  return { via: 'ics', to: calendarEmail }
}

export async function addEventToGoogleCalendar(leave: LeaveWithMember) {
  try {
    const calendarId = calendarTargetEmail()
    if (!calendarId) {
      console.log('Leave calendar skipped: GOOGLE_CALENDAR_ID / SMTP_USER not configured.')
      return null
    }

    if (hasGoogleApiCredentials()) {
      return await insertViaGoogleApi(leave, calendarId)
    }

    return await sendCalendarInvite(leave, calendarId)
  } catch (error) {
    console.error('Error adding leave to Google Calendar:', error)
    return null
  }
}
