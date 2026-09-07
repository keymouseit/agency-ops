import { google } from 'googleapis';
import { LeaveRequest, TeamMember } from '@prisma/client';

export async function addEventToGoogleCalendar(leave: LeaveRequest & { member: TeamMember }) {
  try {
    const credentialsBase64 = process.env.GOOGLE_CREDENTIALS_BASE64;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const calendarId = process.env.GOOGLE_CALENDAR_ID;

    if (!calendarId) {
      console.log('Google Calendar integration skipped: GOOGLE_CALENDAR_ID not configured.');
      return null;
    }

    let auth;

    if (credentialsBase64) {
        // Option A: Base64 encoded JSON credentials file
        const credentialsJson = Buffer.from(credentialsBase64, 'base64').toString('utf-8');
        const credentials = JSON.parse(credentialsJson);
        auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/calendar.events'],
        });
    } else if (clientEmail && privateKey) {
        // Option B: Environment variables
        auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey,
            },
            scopes: ['https://www.googleapis.com/auth/calendar.events'],
        });
    } else {
        console.log('Google Calendar integration skipped: Credentials not configured.');
        return null;
    }

    const calendar = google.calendar({ version: 'v3', auth });

    const startDate = new Date(leave.startDate);
    const endDate = new Date(leave.endDate);
    
    // For full-day events, the end date in Google Calendar should be the day after
    const calendarEndDate = new Date(endDate);
    calendarEndDate.setDate(calendarEndDate.getDate() + 1);

    const timeSlotStr = leave.timeSlot ? ` (${leave.timeSlot.replace('_', ' ')})` : '';

    const event = {
      summary: `${leave.member.name} - Leave${timeSlotStr}`,
      description: `Leave Type: ${leave.leaveType.replace('_', ' ')}\nReason: ${leave.reason || 'N/A'}\nStatus: Approved`,
      start: {
        date: startDate.toISOString().split('T')[0],
      },
      end: {
        date: calendarEndDate.toISOString().split('T')[0],
      }
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    console.log(`Event created in Google Calendar: ${response.data.htmlLink}`);
    return response.data;
  } catch (error) {
    console.error('Error adding event to Google Calendar:', error);
    // Don't throw, just log so we don't break the approval flow if GCal fails
    return null;
  }
}
