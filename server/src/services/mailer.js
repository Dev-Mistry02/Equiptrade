
import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

function getTransporter() {
  const host =
    String(env.smtpHost || '').trim() ||
    String(process.env.SMTP_HOST || '').trim() ||
    'smtp.gmail.com'

  const port = Number(env.smtpPort || process.env.SMTP_PORT || 587)
  const secure =
    process.env.SMTP_SECURE === 'true' || env.smtpSecure === true

  const smtpUser = env.smtpUser || process.env.SMTP_USER
  const smtpPassword = env.smtpPassword || process.env.SMTP_PASSWORD
  const mailFrom = env.mailFrom || process.env.MAIL_FROM || smtpUser

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid TCP port.')
  }

  if (!mailFrom) {
    throw new Error('MAIL_FROM is not configured.')
  }

  if ((smtpUser && !smtpPassword) || (!smtpUser && smtpPassword)) {
    throw new Error(
      'SMTP_USER and SMTP_PASSWORD must both be configured.'
    )
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    ...(smtpUser
      ? {
          auth: {
            user: smtpUser,
            pass: smtpPassword,
          },
        }
      : {}),
  })
}

export async function verifyMailConnection() {
  await getTransporter().verify()
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

async function sendEmail({ to, subject, text, html, replyTo }) {
  if (!to) {
    throw new Error('Recipient email address is missing.')
  }

  const transporter = getTransporter()

  const result = await transporter.sendMail({
    from: env.mailFrom || process.env.MAIL_FROM || env.smtpUser || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
    ...(replyTo ? { replyTo } : {}),
  })

  if (!result.messageId) {
    throw new Error('SMTP server returned no message ID.')
  }

  return result.messageId
}

// OTP verification email
export async function sendOtpEmail(email, name, otp) {
  const safeName = escapeHtml(name || 'there')
  const safeOtp = escapeHtml(otp)

  await sendEmail({
    to: email,
    subject: 'Your EquipTrade India verification code',
    text: `Hello ${name || 'there'},

Your EquipTrade India verification code is ${otp}.

It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#111827;max-width:500px;margin:auto;padding:24px">
        <h2>EquipTrade <span style="color:#f59e0b">India</span></h2>
        <p>Hello ${safeName},</p>
        <p>Your email verification code is:</p>
        <p style="font-size:30px;font-weight:bold;letter-spacing:8px">${safeOtp}</p>
        <p>This code expires in 10 minutes.</p>
        <p style="color:#6b7280;font-size:13px">If you did not request this code, you can ignore this email.</p>
      </div>
    `,
  })
}

// Listing submission confirmation email
export async function sendListingSubmissionEmail(
  email,
  name,
  equipmentName
) {
  const safeName = escapeHtml(name || 'Seller')
  const safeEquipmentName = escapeHtml(equipmentName)

  await sendEmail({
    to: email,
    subject: 'Listing Received — EquipTrade India',
    text: `Hello ${name || 'Seller'},

Your equipment listing "${equipmentName}" has been successfully submitted to EquipTrade India.

Status: Pending Review

Our team will review your listing. We'll send you an email once the review is complete.

Thank you for choosing EquipTrade India.

Best regards,
Team EquipTrade India`,
    html: `
      <div style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
        <div style="max-width:600px;margin:auto">
          <div style="background:#111827;padding:24px;border-radius:12px 12px 0 0">
            <h1 style="margin:0;color:#fff">EquipTrade <span style="color:#f59e0b">India</span></h1>
            <p style="color:#9ca3af">Your equipment marketplace</p>
          </div>
          <div style="background:#fff;padding:28px;border:1px solid #e5e7eb">
            <h2>Listing submitted successfully!</h2>
            <p>Hello ${safeName},</p>
            <p>Thank you for listing your equipment with EquipTrade India. We've received your submission and it's now waiting for review.</p>
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:18px;margin:20px 0">
              <p style="font-size:12px;color:#92400e;font-weight:bold">EQUIPMENT SUBMITTED</p>
              <p style="font-size:17px;font-weight:bold">${safeEquipmentName}</p>
              <span style="background:#fef3c7;color:#92400e;padding:7px 12px;border-radius:20px;font-size:12px">Pending Review</span>
            </div>
            <p>Our team will review your listing. We'll email you when the review is complete.</p>
            <p>Best regards,<br><strong>Team EquipTrade India</strong></p>
          </div>
          <p style="text-align:center;color:#6b7280;font-size:12px">Connecting buyers and sellers of equipment.</p>
        </div>
      </div>
    `,
  })
}

// Buyer enquiry emails to the seller and buyer
export async function sendBuyerEnquiryEmails({
  sellerEmail,
  buyerEmail,
  buyerName,
  buyerMobileNumber,
  message,
  equipmentName,
}) {
  const safeBuyerName = escapeHtml(buyerName)
  const safeBuyerMobileNumber = escapeHtml(buyerMobileNumber)
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>')
  const safeEquipmentName = escapeHtml(equipmentName)
  const safeBuyerEmail = escapeHtml(buyerEmail)

  const [sellerResult, buyerResult] = await Promise.allSettled([
    sendEmail({
      to: sellerEmail,
      replyTo: buyerEmail,
      subject: `Buyer enquiry: ${equipmentName}`,
      text: `You received an enquiry about "${equipmentName}".

From: ${buyerName}
Email: ${buyerEmail}
Mobile: ${buyerMobileNumber}

Message:
${message}`,
      html: `
        <p>You received an enquiry about <strong>${safeEquipmentName}</strong>.</p>
        <p>
          <strong>From:</strong> ${safeBuyerName}<br>
          <strong>Email:</strong> ${safeBuyerEmail}<br>
          <strong>Mobile:</strong> ${safeBuyerMobileNumber}
        </p>
        <p><strong>Message:</strong><br>${safeMessage}</p>
        <p>Reply directly to this email to contact the buyer.</p>
      `,
    }),
    sendEmail({
      to: buyerEmail,
      subject: `Your enquiry for ${equipmentName}`,
      text: `Hello ${buyerName},

Your enquiry for "${equipmentName}" was sent to the seller. They can reply directly to this email.

Your message:
${message}`,
      html: `
        <p>Hello ${safeBuyerName},</p>
        <p>Your enquiry for <strong>${safeEquipmentName}</strong> was sent to the seller.</p>
        <p><strong>Your message:</strong><br>${safeMessage}</p>
      `,
    }),
  ])

  return {
    sellerEmailSent: sellerResult.status === 'fulfilled',
    buyerConfirmationSent: buyerResult.status === 'fulfilled',
    sellerError:
      sellerResult.status === 'rejected' ? sellerResult.reason : null,
    buyerError:
      buyerResult.status === 'rejected' ? buyerResult.reason : null,
  }
}

// Listing approval or rejection email
export async function sendListingStatusEmail(
  email,
  name,
  equipmentName,
  status
) {
  const approved = status === 'approved'
  const safeName = escapeHtml(name || 'Seller')
  const safeEquipmentName = escapeHtml(equipmentName)

  const update = approved
    ? `Your equipment listing "${equipmentName}" has been reviewed and approved. It is now live on EquipTrade India.`
    : `Your equipment listing "${equipmentName}" was reviewed and could not be approved at this time. Please contact EquipTrade India support if you need help.`

  await sendEmail({
    to: email,
    subject: approved
      ? 'Your EquipTrade India listing is approved'
      : 'Update on your EquipTrade India listing',
    text: `Hello ${name || 'Seller'},

${update}

EquipTrade India`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#111827;max-width:560px;margin:auto;padding:24px">
        <h2>EquipTrade <span style="color:#f59e0b">India</span></h2>
        <p>Hello ${safeName},</p>
        <p>${approved
          ? `Your equipment listing <strong>${safeEquipmentName}</strong> has been reviewed and approved. It is now live on EquipTrade India.`
          : `Your equipment listing <strong>${safeEquipmentName}</strong> was reviewed and could not be approved at this time. Please contact EquipTrade India support if you need help.`
        }</p>
        <p>Team EquipTrade India</p>
      </div>
    `,
  })
}
