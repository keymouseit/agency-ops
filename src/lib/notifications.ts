import nodemailer from 'nodemailer';
import { LeaveRequest, TeamMember } from '@prisma/client';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function getEmailTemplate(title: string, contentHtml: string, accentColor: string = '#2563eb') {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
    .header { background-color: ${accentColor}; padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .content { padding: 40px 32px; color: #374151; font-size: 16px; line-height: 1.6; }
    .content p { margin-top: 0; margin-bottom: 16px; }
    .content strong { color: #111827; }
    .details-box { background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid ${accentColor}; }
    .details-row { margin-bottom: 8px; }
    .details-row:last-child { margin-bottom: 0; }
    .details-label { font-weight: 600; color: #4b5563; display: inline-block; width: 80px; }
    .footer { text-align: center; padding-top: 32px; color: #9ca3af; font-size: 14px; }
    .btn { display: inline-block; background-color: ${accentColor}; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px; }
    .logo-text { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; font-weight: 800; color: rgba(255,255,255,0.7); margin-bottom: 12px; display: block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <span class="logo-text">Agency Ops</span>
        <h1>${title}</h1>
      </div>
      <div class="content">
        ${contentHtml}
        <br/>
        <p style="color: #6b7280; font-size: 15px;">Best regards,<br/><strong style="color: #374151;">The HR Team</strong></p>
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Agency Ops. All rights reserved.
    </div>
  </div>
</body>
</html>
  `;
}

export async function sendLeaveApprovalEmail(
  leave: LeaveRequest & { member: TeamMember },
  _approverName?: string
) {
  const actorLabel = 'Management'
  const startDate = new Date(leave.startDate);
  const endDate = new Date(leave.endDate);
  const timeSlotStr = leave.timeSlot ? ` (${leave.timeSlot.replace('_', ' ')})` : '';
  const notesHtml = leave.approvalNotes
    ? `<div class="details-row"><span class="details-label">Comment:</span> ${leave.approvalNotes}</div>`
    : '';

  const mailOptions = {
    from: `"Agency Ops" <${process.env.SMTP_USER}>`,
    to: leave.member.email,
    subject: `Leave Request Approved - ${leave.leaveType.replace(/_/g, ' ')}${timeSlotStr}`,
    text: `Hello ${leave.member.name},\n\nYour leave request from ${startDate.toDateString()} to ${endDate.toDateString()} has been approved by ${actorLabel}.\n${leave.approvalNotes ? `Comment: ${leave.approvalNotes}\n` : ''}\nBest,\nHR Team`,
    html: getEmailTemplate(
      'Leave Request Approved',
      `
      <p>Hello <strong>${leave.member.name}</strong>,</p>
      <p>Great news! Your leave request has been approved by <strong>${actorLabel}</strong>.</p>
      
      <div class="details-box">
        <div class="details-row"><span class="details-label">Dates:</span> <strong>${startDate.toDateString()}</strong> to <strong>${endDate.toDateString()}</strong></div>
        <div class="details-row"><span class="details-label">Type:</span> <span style="text-transform: capitalize;">${leave.leaveType.replace(/_/g, ' ')}${timeSlotStr}</span></div>
        <div class="details-row"><span class="details-label">Approved by:</span> <strong>${actorLabel}</strong></div>
        ${notesHtml}
      </div>
      
      <p>Enjoy your time off! Your approved leave has been recorded in the system.</p>
      `,
      '#16a34a' // Green color for approval
    ),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (err: unknown) {
    console.error('Error sending email:', err);
    throw err;
  }
}

export async function sendLeaveAppliedEmail(leave: LeaveRequest & { member: TeamMember }, hrEmail: string) {
  const startDate = new Date(leave.startDate);
  const endDate = new Date(leave.endDate);
  const timeSlotStr = leave.timeSlot ? ` (${leave.timeSlot.replace('_', ' ')})` : '';

  const mailOptions = {
    from: `"Agency Ops" <${process.env.SMTP_USER}>`,
    to: hrEmail,
    subject: `New Leave Request - ${leave.member.name}`,
    text: `Hello,\n\n${leave.member.name} has applied for leave from ${startDate.toDateString()} to ${endDate.toDateString()}.\n\nType: ${leave.leaveType.replace(/_/g, ' ')}${timeSlotStr}\nReason: ${leave.reason || 'N/A'}\n\nPlease review this request in the admin dashboard.\n\nBest,\nSystem`,
    html: getEmailTemplate(
      'New Leave Request',
      `
      <p>Hello,</p>
      <p><strong>${leave.member.name}</strong> has submitted a new leave request that requires your review.</p>
      
      <div class="details-box">
        <div class="details-row"><span class="details-label">Employee:</span> <strong>${leave.member.name}</strong></div>
        <div class="details-row"><span class="details-label">Dates:</span> <strong>${startDate.toDateString()}</strong> to <strong>${endDate.toDateString()}</strong></div>
        <div class="details-row"><span class="details-label">Type:</span> <span style="text-transform: capitalize;">${leave.leaveType.replace(/_/g, ' ')}${timeSlotStr}</span></div>
        <div class="details-row"><span class="details-label">Reason:</span> ${leave.reason || '<em>Not provided</em>'}</div>
      </div>
      
      <p>Please log in to the Agency Ops dashboard to approve or reject this request.</p>
      `,
      '#2563eb' // Blue color for generic info
    ),
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('Error sending leave applied email:', err);
  }
}

export async function sendLeaveRejectedEmail(
  leave: LeaveRequest & { member: TeamMember },
  _rejectorName?: string
) {
  const actorLabel = 'Management'
  const startDate = new Date(leave.startDate);
  const endDate = new Date(leave.endDate);
  const timeSlotStr = leave.timeSlot ? ` (${leave.timeSlot.replace('_', ' ')})` : '';

  const mailOptions = {
    from: `"Agency Ops" <${process.env.SMTP_USER}>`,
    to: leave.member.email,
    subject: `Leave Request Rejected - ${leave.leaveType.replace(/_/g, ' ')}${timeSlotStr}`,
    text: `Hello ${leave.member.name},\n\nYour leave request from ${startDate.toDateString()} to ${endDate.toDateString()} has been rejected by ${actorLabel}.\n\nReason: ${leave.approvalNotes || 'No reason provided'}\n\nBest,\nHR Team`,
    html: getEmailTemplate(
      'Leave Request Update',
      `
      <p>Hello <strong>${leave.member.name}</strong>,</p>
      <p>Your leave request has been declined by <strong>${actorLabel}</strong>.</p>
      
      <div class="details-box">
        <div class="details-row"><span class="details-label">Dates:</span> <strong>${startDate.toDateString()}</strong> to <strong>${endDate.toDateString()}</strong></div>
        <div class="details-row"><span class="details-label">Type:</span> <span style="text-transform: capitalize;">${leave.leaveType.replace(/_/g, ' ')}${timeSlotStr}</span></div>
        <div class="details-row"><span class="details-label">Rejected by:</span> <strong>${actorLabel}</strong></div>
        <div class="details-row"><span class="details-label" style="color: #dc2626;">Reason:</span> <strong>${leave.approvalNotes || 'No specific reason provided.'}</strong></div>
      </div>
      
      <p>If you have any questions or need to discuss this further, please reach out to the HR team or your manager.</p>
      `,
      '#dc2626' // Red color for rejection
    ),
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('Error sending leave rejected email:', err);
  }
}
