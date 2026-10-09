import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

function getTransporter() {
  if (!env.smtpHost) {
    throw new Error('SMTP_HOST is not configured.')
  }

  if (!Number.isInteger(env.smtpPort) || env.smtpPort < 1 || env.smtpPort > 65535) {
    throw new Error('SMTP_PORT must be a valid TCP port.')
  }

  if (!env.mailFrom) {
    throw new Error('MAIL_FROM is not configured.')
  }

  if ((env.smtpUser && !env.smtpPassword) || (!env.smtpUser && env.smtpPassword)) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must both be configured when SMTP authentication is used.')
  }

  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    ...(env.smtpUser
      ? { auth: { user: env.smtpUser, pass: env.smtpPassword } }
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

  const result = await getTransporter().sendMail({
    from: env.mailFrom,
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

export async function sendOtpEmail(email, name, otp) {
  const safeName = escapeHtml(name || 'there')

  await sendEmail({
    to: email,
    subject: 'Your EquipTrade India verification code',
    text: `Hello ${name || 'there'},\n\nYour EquipTrade India verification code is ${otp}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
    html: `<p>Hello ${safeName},</p><p>Your EquipTrade India verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:8px">${otp}</p><p>This code expires in 10 minutes. If you did not request this code, you can ignore this email.</p>`,
  })
}

export async function sendListingSubmissionEmail(email, name, equipmentName) {
  const safeName = escapeHtml(name || 'Seller')
  const safeEquipmentName = escapeHtml(equipmentName)


  await sendEmail({
    to: email,
    subject: "Listing Received — EquipTrade India",

    text: `Hello ${name || "Seller"},

Your equipment listing "${equipmentName}" has been successfully submitted to EquipTrade India.

Status: Pending Review

Our team will review your listing. We'll send you an email once the review is complete.

Thank you for choosing EquipTrade India.

Best regards,
Team EquipTrade India`,

    html: `
    <div style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

        <div style="background:#111827;padding:24px 30px;border-radius:14px 14px 0 0;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;letter-spacing:-0.5px;">
            EquipTrade <span style="color:#f59e0b;">India</span>
          </h1>
          <p style="margin:8px 0 0;color:#9ca3af;font-size:13px;">
            Your equipment marketplace
          </p>
        </div>

        <div style="background:#ffffff;padding:32px 30px;border:1px solid #e5e7eb;border-top:none;">

          <div style="font-size:34px;margin-bottom:18px;">&#10003;</div>

          <h2 style="margin:0 0 14px;font-size:24px;color:#111827;">
            Listing submitted successfully!
          </h2>

          <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:#4b5563;">
            Hello ${safeName},<br><br>
            Thank you for listing your equipment with EquipTrade India.
            We've received your submission and it's now waiting for review.
          </p>

          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:18px;margin:22px 0;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:bold;color:#92400e;text-transform:uppercase;letter-spacing:1px;">
              Equipment submitted
            </p>
            <p style="margin:0 0 14px;font-size:17px;font-weight:bold;color:#111827;">
              ${safeEquipmentName}
            </p>
            <span style="display:inline-block;background:#fef3c7;color:#92400e;padding:7px 12px;border-radius:20px;font-size:12px;font-weight:bold;">
              &#9679; Pending Review
            </span>
          </div>

          <p style="margin:20px 0;font-size:14px;line-height:1.8;color:#4b5563;">
            Our team will review your listing to ensure the details are accurate.
            We'll email you when the review is complete.
          </p>

          <div style="height:1px;background:#e5e7eb;margin:26px 0;"></div>

          <p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;">
            Thank you for choosing <strong style="color:#111827;">EquipTrade India</strong>.
            We appreciate your trust in our marketplace.
          </p>

          <p style="margin:22px 0 0;font-size:14px;color:#111827;">
            Best regards,<br>
            <strong>Team EquipTrade India</strong>
          </p>
        </div>

        <div style="padding:20px 16px;text-align:center;">
          <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">
            Connecting buyers and sellers of equipment.
          </p>
          <p style="margin:0;font-size:11px;color:#9ca3af;">
            This is an automated email. Please do not reply directly.
          </p>
        </div>

      </div>
    </div>
  `,
  });
}

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

  const [sellerResult, buyerResult] = await Promise.allSettled([
    sendEmail({
      to: sellerEmail,
      replyTo: buyerEmail,
      subject: `Buyer enquiry: ${equipmentName}`,
      text: `You received an enquiry about "${equipmentName}".\n\nFrom: ${buyerName}\nEmail: ${buyerEmail}\nMobile: ${buyerMobileNumber}\n\nMessage:\n${message}`,
      html: `<p>You received an enquiry about <strong>${safeEquipmentName}</strong>.</p><p><strong>From:</strong> ${safeBuyerName}<br><strong>Email:</strong> ${escapeHtml(buyerEmail)}<br><strong>Mobile:</strong> ${safeBuyerMobileNumber}</p><p><strong>Message:</strong><br>${safeMessage}</p><p>Reply directly to this email to contact the buyer.</p>`,
    }),
    sendEmail({
      to: buyerEmail,
      subject: `Your enquiry for ${equipmentName}`,
      text: `Hello ${buyerName},\n\nYour enquiry for "${equipmentName}" was sent to the seller. They can reply directly to this email.\n\nYour message:\n${message}`,
      html: `<p>Hello ${safeBuyerName},</p><p>Your enquiry for <strong>${safeEquipmentName}</strong> was sent to the seller. They can reply directly to this email.</p><p><strong>Your message:</strong><br>${safeMessage}</p>`,
    }),
  ])

  return {
    sellerEmailSent: sellerResult.status === 'fulfilled',
    buyerConfirmationSent: buyerResult.status === 'fulfilled',
    sellerError: sellerResult.status === 'rejected' ? sellerResult.reason : null,
    buyerError: buyerResult.status === 'rejected' ? buyerResult.reason : null,
  }
}

export async function sendListingStatusEmail(email, name, equipmentName, status) {
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
    text: `Hello ${name || 'Seller'},\n\n${update}\n\nEquipTrade India`,
    html: `<p>Hello ${safeName},</p><p>${approved
      ? `Your equipment listing <strong>${safeEquipmentName}</strong> has been reviewed and approved. It is now live on EquipTrade India.`
      : `Your equipment listing <strong>${safeEquipmentName}</strong> was reviewed and could not be approved at this time. Please contact EquipTrade India support if you need help.`}</p><p>EquipTrade India</p>`,
  })
}
