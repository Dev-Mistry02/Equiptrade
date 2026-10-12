import { env } from '../config/env.js'

function getResendConfig() {
  const apiKey = (env.resendApiKey || process.env.RESEND_API_KEY || '').trim()
  const from = (env.mailFrom || process.env.MAIL_FROM || '').trim()

  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.')
  if (!from) throw new Error('MAIL_FROM is not configured.')

  return { apiKey, from }
}

async function resendRequest(path, options = {}) {
  const { apiKey } = getResendConfig()
  let response

  try {
    response = await fetch(`https://api.resend.com${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      signal: AbortSignal.timeout(15000),
    })
  } catch (error) {
    throw new Error(`Could not connect to Resend: ${error.message}`)
  }

  const responseText = await response.text()
  let result = {}

  try {
    result = responseText ? JSON.parse(responseText) : {}
  } catch {
    result = { message: responseText }
  }

  if (!response.ok) {
    const error = new Error(
      `Resend request failed (${response.status}): ${result.message || result.name || 'Unknown provider error'
      }`,
    )
    error.status = response.status
    error.providerError = result.name || null
    throw error
  }

  return result
}

export async function verifyMailConnection(testRecipient) {
  if (!testRecipient) {
    throw new Error('Provide a test recipient to verify email sending.')
  }

  return sendEmail({
    to: testRecipient,
    subject: 'EquipTrade India | Email configuration test',
    text: 'Your EquipTrade India email integration is working.',
    html: emailLayout({
      eyebrow: 'SYSTEM TEST',
      title: 'Your email setup is working',
      intro: 'Your EquipTrade India email integration is configured correctly.',
      body: `<p style="margin:0;color:#475569;font-size:15px;line-height:1.7">This is a test message confirming that the application can send emails successfully.</p>`,
    }),
  })
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

function emailLayout({
  eyebrow = 'EQUIPTRADE INDIA',
  title,
  intro = '',
  body = '',
  buttonText = '',
  buttonUrl = '',
  footerNote = 'Connecting buyers and sellers of equipment.',
}) {
  const safeTitle = escapeHtml(title)
  const safeEyebrow = escapeHtml(eyebrow)
  const safeIntro = escapeHtml(intro)
  const safeButtonText = escapeHtml(buttonText)
  const safeButtonUrl = escapeHtml(buttonUrl)

  const button = buttonText && buttonUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 4px"><tr><td bgcolor="#f59e0b" style="border-radius:8px"><a href="${safeButtonUrl}" style="display:inline-block;padding:13px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:1;color:#111827;text-decoration:none;border-radius:8px">${safeButtonText}</a></td></tr></table>`
    : ''

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#111827">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${safeIntro}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1f5f9;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px">
        <tr><td style="background:#111827;padding:25px 28px;border-radius:14px 14px 0 0">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td style="font-size:23px;font-weight:800;letter-spacing:-.5px;color:#ffffff">EquipTrade <span style="color:#f59e0b">India</span></td>
            <td align="right" style="font-size:10px;letter-spacing:1.4px;color:#cbd5e1;font-weight:700">MARKETPLACE</td>
          </tr></table>
          <div style="padding-top:9px;color:#cbd5e1;font-size:12px;line-height:1.5">A smarter way to buy and sell equipment</div>
        </td></tr>
        <tr><td style="background:#ffffff;padding:32px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
          <div style="font-size:10px;font-weight:800;letter-spacing:1.7px;color:#b45309;margin-bottom:12px">${safeEyebrow}</div>
          <h1 style="margin:0 0 14px;font-size:26px;line-height:1.25;letter-spacing:-.6px;color:#111827">${safeTitle}</h1>
          ${intro ? `<p style="margin:0 0 22px;font-size:15px;line-height:1.75;color:#475569">${safeIntro}</p>` : ''}
          ${body}
          ${button}
          <div style="height:1px;background:#e2e8f0;margin:28px 0 20px"></div>
          <p style="margin:0;color:#334155;font-size:14px;line-height:1.7">Regards,<br><strong style="color:#111827">Team EquipTrade India</strong></p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:18px 24px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 14px 14px;text-align:center">
          <p style="margin:0 0 7px;color:#64748b;font-size:11px;line-height:1.6">${escapeHtml(footerNote)}</p>
          <p style="margin:0;color:#94a3b8;font-size:10px;line-height:1.6">This is an automated message from EquipTrade India. Please do not share sensitive account information by email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function infoCard(label, value, options = {}) {
  const safeLabel = escapeHtml(label)
  const safeValue = escapeHtml(value)
  const accent = options.accent || '#f59e0b'
  const valueColor = options.valueColor || '#111827'
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;background:#fffbeb;border:1px solid #fde68a;border-left:4px solid ${accent};border-radius:10px"><tr><td style="padding:17px 18px"><div style="font-size:10px;font-weight:800;letter-spacing:1.3px;color:#92400e;margin-bottom:8px">${safeLabel}</div><div style="font-size:16px;line-height:1.5;font-weight:700;color:${valueColor}">${safeValue}</div></td></tr></table>`
}

function statusPill(label, approved) {
  const color = approved ? '#166534' : '#92400e'
  const background = approved ? '#dcfce7' : '#fef3c7'
  return `<span style="display:inline-block;padding:7px 11px;border-radius:999px;background:${background};color:${color};font-size:12px;font-weight:700">${escapeHtml(label)}</span>`
}

async function sendEmail({ to, subject, text, html, replyTo }) {
  if (!to || (Array.isArray(to) && to.length === 0)) {
    throw new Error('Recipient email address is missing.')
  }

  const recipients = (Array.isArray(to) ? to : [to])
    .map(email => String(email).trim())
    .filter(Boolean)

  if (recipients.length === 0) {
    throw new Error('No valid recipient addresses were provided.')
  }

  const { from } = getResendConfig()
  const result = await resendRequest('/emails', {
    method: 'POST',
    body: JSON.stringify({
      from,
      to: recipients,
      subject,
      ...(text ? { text } : {}),
      ...(html ? { html } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  })

  if (!result.id) throw new Error('Resend response did not include an email ID.')
  return result.id
}

// OTP verification email
export async function sendOtpEmail(email, name, otp) {
  const safeOtp = escapeHtml(otp)
  const safeName = escapeHtml(name || 'there')

  return sendEmail({
    to: email,
    subject: 'Your EquipTrade India verification code',
    text: `Hello ${name || 'there'},

Your EquipTrade India verification code is ${otp}.

It expires in 10 minutes. If you requested more than one code, any code sent in the last 10 minutes can be used until it expires. If you did not request this code, you can ignore this email.`,
    html: emailLayout({
      eyebrow: 'ACCOUNT SECURITY',
      title: 'Verify your email address',
      intro: `Hello ${name || 'there'}, use the verification code below to complete your email verification.`,
      body: `<div style="margin:24px 0;padding:24px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;text-align:center"><div style="font-size:11px;letter-spacing:1.5px;font-weight:700;color:#64748b;margin-bottom:12px">YOUR VERIFICATION CODE</div><div style="font-size:32px;font-weight:800;letter-spacing:9px;color:#111827">${safeOtp}</div></div><p style="margin:0 0 12px;color:#475569;font-size:14px;line-height:1.7"><strong>This code expires in 10 minutes.</strong> If you requested more than one code, any code sent in the last 10 minutes can be used until it expires. For your security, never share a code with anyone.</p><p style="margin:0;color:#64748b;font-size:13px;line-height:1.7">If you did not request this code, you can safely ignore this email.</p>`,
      footerNote: 'Keeping your EquipTrade India account secure.',
    }),
  })
}

// Listing submission confirmation email
export async function sendListingSubmissionEmail(email, name, equipmentName) {
  const safeName = escapeHtml(name || "Seller");
  const safeEquipmentName = escapeHtml(equipmentName || "Your equipment");

  return sendEmail({
    to: email,
    subject: "We've received your listing | EquipTrade India",

    text: `Hello ${name || "Seller"},

Thank you for listing your equipment on EquipTrade India.

We've successfully received your submission for "${equipmentName}" and it is now awaiting review by our team.

Listing Details:
Equipment: ${equipmentName}
Status: Pending Review

WHAT HAPPENS NEXT?
1. Our team reviews your equipment details.
2. We verify the submitted information.
3. You'll receive an email once a decision has been made.

Your listing will appear in the marketplace after approval.

Thank you for choosing EquipTrade India.

Regards,
Team EquipTrade India`,

    html: emailLayout({
      eyebrow: "LISTING CONFIRMATION",

      title: "Your equipment listing is in!",

      intro: `Hello ${safeName}, thank you for choosing EquipTrade India. We've successfully received your equipment submission, and our team will review it shortly.`,

      body: `
        <!-- Confirmation banner -->
        <div style="
          margin: 24px 0;
          padding: 18px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 12px;
        ">
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
          >
            <tr>
              <td width="42" valign="top">
                <div style="
                  width: 32px;
                  height: 32px;
                  line-height: 32px;
                  text-align: center;
                  border-radius: 50%;
                  background: #dcfce7;
                  color: #15803d;
                  font-size: 18px;
                  font-weight: bold;
                ">✓</div>
              </td>

              <td valign="middle">
                <div style="
                  color: #166534;
                  font-size: 15px;
                  font-weight: 700;
                  margin-bottom: 5px;
                ">
                  Submission successful
                </div>

                <div style="
                  color: #15803d;
                  font-size: 13px;
                  line-height: 1.6;
                ">
                  Your listing has been received and is awaiting review.
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Equipment details -->
        <div style="
          margin: 24px 0;
          padding: 22px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
        ">
          <div style="
            margin-bottom: 8px;
            color: #64748b;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 1.5px;
          ">
            EQUIPMENT SUBMITTED
          </div>

          <div style="
            margin-bottom: 18px;
            color: #111827;
            font-size: 19px;
            font-weight: 700;
            line-height: 1.5;
            overflow-wrap: anywhere;
          ">
            ${safeEquipmentName}
          </div>

          <div style="
            height: 1px;
            background: #e2e8f0;
            margin-bottom: 17px;
          "></div>

          <div style="
            margin-bottom: 9px;
            color: #64748b;
            font-size: 11px;
            font-weight: 700;
          ">
            CURRENT STATUS
          </div>

          ${statusPill("Pending Review", false)}
        </div>

        <!-- Next steps -->
        <div style="margin: 28px 0;">
          <h2 style="
            margin: 0 0 18px;
            color: #111827;
            font-size: 17px;
            line-height: 1.4;
          ">
            What happens next?
          </h2>

          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
          >
            <tr>
              <td width="34" valign="top" style="padding-bottom: 17px;">
                <div style="
                  width: 27px;
                  height: 27px;
                  line-height: 27px;
                  text-align: center;
                  border-radius: 50%;
                  background: #fffbeb;
                  color: #b45309;
                  font-size: 12px;
                  font-weight: 700;
                ">1</div>
              </td>

              <td valign="top" style="padding-bottom: 17px;">
                <div style="
                  color: #111827;
                  font-size: 14px;
                  font-weight: 700;
                  margin-bottom: 4px;
                ">Listing review</div>

                <div style="
                  color: #64748b;
                  font-size: 13px;
                  line-height: 1.7;
                ">
                  Our team checks your submitted equipment details.
                </div>
              </td>
            </tr>

            <tr>
              <td width="34" valign="top" style="padding-bottom: 17px;">
                <div style="
                  width: 27px;
                  height: 27px;
                  line-height: 27px;
                  text-align: center;
                  border-radius: 50%;
                  background: #fffbeb;
                  color: #b45309;
                  font-size: 12px;
                  font-weight: 700;
                ">2</div>
              </td>

              <td valign="top" style="padding-bottom: 17px;">
                <div style="
                  color: #111827;
                  font-size: 14px;
                  font-weight: 700;
                  margin-bottom: 4px;
                ">Information verification</div>

                <div style="
                  color: #64748b;
                  font-size: 13px;
                  line-height: 1.7;
                ">
                  We verify the information before making the listing available.
                </div>
              </td>
            </tr>

            <tr>
              <td width="34" valign="top">
                <div style="
                  width: 27px;
                  height: 27px;
                  line-height: 27px;
                  text-align: center;
                  border-radius: 50%;
                  background: #fffbeb;
                  color: #b45309;
                  font-size: 12px;
                  font-weight: 700;
                ">3</div>
              </td>

              <td valign="top">
                <div style="
                  color: #111827;
                  font-size: 14px;
                  font-weight: 700;
                  margin-bottom: 4px;
                ">Email notification</div>

                <div style="
                  color: #64748b;
                  font-size: 13px;
                  line-height: 1.7;
                ">
                  We'll notify you by email when the review is complete.
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Important note -->
        <div style="
          margin-top: 25px;
          padding: 15px 17px;
          background: #fffbeb;
          border-left: 3px solid #f59e0b;
          border-radius: 5px;
        ">
          <div style="
            margin-bottom: 5px;
            color: #92400e;
            font-size: 13px;
            font-weight: 700;
          ">
            Please note
          </div>

          <div style="
            color: #78350f;
            font-size: 13px;
            line-height: 1.7;
          ">
            Your equipment listing will be published only after it has been approved by our team.
          </div>
        </div>
      `,

      footerNote:
        "Thank you for helping build a trusted equipment marketplace with EquipTrade India.",
    }),
  });
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
  const safeBuyerName = escapeHtml(buyerName || "Buyer");
  const safeBuyerMobileNumber = escapeHtml(
    buyerMobileNumber || "Not provided"
  );
  const safeMessage = escapeHtml(message || "").replace(/\r?\n/g, "<br>");
  const safeEquipmentName = escapeHtml(equipmentName || "Equipment listing");
  const safeBuyerEmail = escapeHtml(buyerEmail || "");

  const [sellerResult, buyerResult] = await Promise.allSettled([
    // =====================================================
    // SELLER EMAIL — NEW BUYER ENQUIRY
    // =====================================================
    sendEmail({
      to: sellerEmail,
      replyTo: buyerEmail,
      subject: `New enquiry received | ${equipmentName}`,

      text: `Hello,

You have received a new buyer enquiry on EquipTrade India.

Equipment: ${equipmentName}

BUYER DETAILS
Name: ${buyerName || "Buyer"}
Email: ${buyerEmail}
Mobile: ${buyerMobileNumber || "Not provided"}

BUYER MESSAGE
${message || "No message provided."}

You can reply directly to this email to contact the buyer.

Regards,
Team EquipTrade India`,

      html: emailLayout({
        eyebrow: "NEW BUYER ENQUIRY",

        title: "Someone is interested in your equipment",

        intro: `Hello Seller, you've received a new enquiry through EquipTrade India. Review the buyer's details below to follow up.`,

        body: `
          <!-- Enquiry notification -->
          <div style="
            margin:24px 0;
            padding:18px;
            background:#eff6ff;
            border:1px solid #bfdbfe;
            border-radius:12px;
          ">
            <div style="
              margin-bottom:6px;
              color:#1d4ed8;
              font-size:10px;
              font-weight:800;
              letter-spacing:1.4px;
            ">
              ACTION REQUIRED
            </div>

            <div style="
              color:#1e3a8a;
              font-size:15px;
              font-weight:700;
              line-height:1.6;
            ">
              A potential buyer has contacted you.
            </div>

            <div style="
              margin-top:5px;
              color:#1e40af;
              font-size:13px;
              line-height:1.7;
            ">
              Connect with the buyer to discuss equipment availability,
              pricing, and other details.
            </div>
          </div>

          <!-- Equipment card -->
          <div style="
            margin:24px 0;
            padding:22px;
            background:#f8fafc;
            border:1px solid #e2e8f0;
            border-radius:12px;
          ">
            <div style="
              margin-bottom:9px;
              color:#64748b;
              font-size:10px;
              font-weight:800;
              letter-spacing:1.4px;
            ">
              EQUIPMENT ENQUIRY
            </div>

            <div style="
              color:#111827;
              font-size:20px;
              font-weight:700;
              line-height:1.5;
              overflow-wrap:anywhere;
            ">
              ${safeEquipmentName}
            </div>

            <div style="
              margin-top:14px;
              display:inline-block;
              padding:7px 11px;
              background:#fffbeb;
              border:1px solid #fde68a;
              border-radius:6px;
              color:#92400e;
              font-size:11px;
              font-weight:700;
            ">
              New enquiry
            </div>
          </div>

          <!-- Buyer information -->
          <h2 style="
            margin:28px 0 14px;
            color:#111827;
            font-size:17px;
          ">
            Buyer contact details
          </h2>

          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
              border:1px solid #e2e8f0;
              border-radius:10px;
              overflow:hidden;
            "
          >
            <tr>
              <td style="
                padding:15px 17px;
                background:#ffffff;
                border-bottom:1px solid #e2e8f0;
              ">
                <div style="
                  margin-bottom:5px;
                  color:#64748b;
                  font-size:10px;
                  font-weight:700;
                  letter-spacing:1px;
                ">BUYER NAME</div>

                <div style="
                  color:#111827;
                  font-size:14px;
                  font-weight:700;
                  overflow-wrap:anywhere;
                ">${safeBuyerName}</div>
              </td>
            </tr>

            <tr>
              <td style="
                padding:15px 17px;
                background:#ffffff;
                border-bottom:1px solid #e2e8f0;
              ">
                <div style="
                  margin-bottom:5px;
                  color:#64748b;
                  font-size:10px;
                  font-weight:700;
                  letter-spacing:1px;
                ">EMAIL ADDRESS</div>

                <div style="
                  color:#111827;
                  font-size:14px;
                  overflow-wrap:anywhere;
                ">${safeBuyerEmail}</div>
              </td>
            </tr>

            <tr>
              <td style="padding:15px 17px;background:#ffffff">
                <div style="
                  margin-bottom:5px;
                  color:#64748b;
                  font-size:10px;
                  font-weight:700;
                  letter-spacing:1px;
                ">MOBILE NUMBER</div>

                <div style="
                  color:#111827;
                  font-size:14px;
                  font-weight:600;
                ">${safeBuyerMobileNumber}</div>
              </td>
            </tr>
          </table>

          <!-- Message card -->
          <h2 style="
            margin:28px 0 13px;
            color:#111827;
            font-size:17px;
          ">
            Message from the buyer
          </h2>

          <div style="
            padding:19px;
            background:#fffbeb;
            border:1px solid #fde68a;
            border-left:4px solid #f59e0b;
            border-radius:9px;
            color:#334155;
            font-size:14px;
            line-height:1.85;
            overflow-wrap:anywhere;
          ">
            ${safeMessage || "No message provided."}
          </div>

          <!-- Reply guidance -->
          <div style="
            margin-top:24px;
            padding:17px;
            background:#f8fafc;
            border:1px solid #e2e8f0;
            border-radius:10px;
          ">
            <div style="
              margin-bottom:6px;
              color:#111827;
              font-size:13px;
              font-weight:700;
            ">
              Ready to respond?
            </div>

            <div style="
              color:#64748b;
              font-size:13px;
              line-height:1.8;
            ">
              Reply directly to this email to contact the buyer.
              The reply address is set to the buyer's email address.
            </div>
          </div>
        `,

        footerNote:
          "Respond promptly to build trust and help buyers make informed decisions.",
      }),
    }),

    // =====================================================
    // BUYER EMAIL — ENQUIRY CONFIRMATION
    // =====================================================
    sendEmail({
      to: buyerEmail,
      subject: `Enquiry confirmation | ${equipmentName}`,

      text: `Hello ${buyerName || "Buyer"},

Your enquiry has been successfully sent to the seller on EquipTrade India.

Equipment: ${equipmentName}

YOUR MESSAGE
${message || "No message provided."}

The seller can now review your enquiry and contact you using the details you provided.

Thank you for using EquipTrade India.

Regards,
Team EquipTrade India`,

      html: emailLayout({
        eyebrow: "ENQUIRY CONFIRMATION",

        title: "Your enquiry is on its way",

        intro: `Hello ${safeBuyerName}, your enquiry has been sent successfully. The seller can now review your message and contact you directly.`,

        body: `
          <!-- Success banner -->
          <div style="
            margin:24px 0;
            padding:19px;
            background:#f0fdf4;
            border:1px solid #bbf7d0;
            border-radius:12px;
          ">
            <table
              role="presentation"
              width="100%"
              cellspacing="0"
              cellpadding="0"
              border="0"
            >
              <tr>
                <td width="43" valign="top">
                  <div style="
                    width:32px;
                    height:32px;
                    line-height:32px;
                    text-align:center;
                    border-radius:50%;
                    background:#dcfce7;
                    color:#15803d;
                    font-size:18px;
                    font-weight:700;
                  ">✓</div>
                </td>

                <td valign="middle">
                  <div style="
                    margin-bottom:5px;
                    color:#166534;
                    font-size:15px;
                    font-weight:700;
                  ">
                    Enquiry sent successfully
                  </div>

                  <div style="
                    color:#15803d;
                    font-size:13px;
                    line-height:1.7;
                  ">
                    Your message has been forwarded to the seller.
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <!-- Equipment summary -->
          <div style="
            margin:24px 0;
            padding:22px;
            background:#f8fafc;
            border:1px solid #e2e8f0;
            border-radius:12px;
          ">
            <div style="
              margin-bottom:9px;
              color:#64748b;
              font-size:10px;
              font-weight:800;
              letter-spacing:1.4px;
            ">
              EQUIPMENT YOU ENQUIRED ABOUT
            </div>

            <div style="
              color:#111827;
              font-size:19px;
              font-weight:700;
              line-height:1.5;
              overflow-wrap:anywhere;
            ">
              ${safeEquipmentName}
            </div>

            <div style="
              height:1px;
              background:#e2e8f0;
              margin:17px 0;
            "></div>

            <div style="
              color:#64748b;
              font-size:12px;
              line-height:1.7;
            ">
              Keep this email for your records so you can refer to
              the equipment enquiry later.
            </div>
          </div>

          <!-- Buyer message -->
          <h2 style="
            margin:28px 0 13px;
            color:#111827;
            font-size:17px;
          ">
            Your submitted message
          </h2>

          <div style="
            padding:19px;
            background:#ffffff;
            border:1px solid #e2e8f0;
            border-radius:10px;
            color:#334155;
            font-size:14px;
            line-height:1.85;
            overflow-wrap:anywhere;
          ">
            ${safeMessage || "No message provided."}
          </div>

          <!-- Next steps -->
          <div style="margin:28px 0 8px">
            <h2 style="
              margin:0 0 12px;
              color:#111827;
              font-size:17px;
            ">
              What happens next?
            </h2>

            <div style="
              color:#475569;
              font-size:14px;
              line-height:1.9;
            ">
              <div style="margin-bottom:8px">
                <strong style="color:#b45309">01.</strong>
                The seller reviews your enquiry.
              </div>

              <div style="margin-bottom:8px">
                <strong style="color:#b45309">02.</strong>
                The seller may contact you using your submitted details.
              </div>

              <div>
                <strong style="color:#b45309">03.</strong>
                You can discuss pricing, availability, and other equipment details.
              </div>
            </div>
          </div>

          <div style="
            margin-top:24px;
            padding:16px;
            background:#fffbeb;
            border-left:3px solid #f59e0b;
            border-radius:6px;
          ">
            <div style="
              color:#92400e;
              font-size:13px;
              font-weight:700;
              margin-bottom:5px;
            ">
              Thank you for choosing EquipTrade India
            </div>

            <div style="
              color:#78350f;
              font-size:13px;
              line-height:1.7;
            ">
              We're helping connect equipment buyers and sellers
              through a simpler marketplace experience.
            </div>
          </div>
        `,

        footerNote:
          "This email confirms that your enquiry was sent. Seller response times may vary.",
      }),
    }),
  ]);

  return {
    sellerEmailSent: sellerResult.status === "fulfilled",
    buyerConfirmationSent: buyerResult.status === "fulfilled",

    sellerError:
      sellerResult.status === "rejected"
        ? sellerResult.reason.message
        : null,

    buyerError:
      buyerResult.status === "rejected"
        ? buyerResult.reason.message
        : null,
  };
}


// Listing approval or rejection email
export async function sendListingStatusEmail(
  email,
  name,
  equipmentName,
  status
) {
  const approved = status === "approved";

  const safeName = escapeHtml(name || "Seller");
  const safeEquipmentName = escapeHtml(
    equipmentName || "Your equipment"
  );

  const subject = approved
    ? "Congratulations! Your listing is approved | EquipTrade India"
    : "Important update about your listing | EquipTrade India";

  const title = approved
    ? "Your equipment is now live!"
    : "An update on your listing";

  const intro = approved
    ? `Hello ${safeName}, great news! Your equipment listing has been reviewed and approved by our team. It is now live on EquipTrade India.`
    : `Hello ${safeName}, our team has reviewed your equipment listing. Unfortunately, it could not be approved at this time. Please contact our support team if you need clarification.`;

  const textUpdate = approved
    ? `Your equipment listing "${equipmentName}" has been approved and is now live on EquipTrade India.`
    : `Your equipment listing "${equipmentName}" could not be approved at this time. Please contact EquipTrade India support for more information.`;

  const statusLabel = approved
    ? "Approved and published"
    : "Not approved";

  const statusColor = approved ? "#15803d" : "#b45309";
  const statusBackground = approved ? "#dcfce7" : "#fef3c7";
  const statusBorder = approved ? "#bbf7d0" : "#fde68a";

  const statusIcon = approved ? "✓" : "!";

  const statusDescription = approved
    ? "Your listing has successfully passed our review and is available for buyers to discover."
    : "Your listing is not currently published. Please contact our support team to understand the next steps.";

  const nextSteps = approved
    ? `
      <div style="margin-top:28px">
        <h2 style="margin:0 0 15px;color:#111827;font-size:17px">
          What happens next?
        </h2>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td width="34" valign="top" style="padding-bottom:14px">
              <div style="width:26px;height:26px;line-height:26px;text-align:center;border-radius:50%;background:#fffbeb;color:#b45309;font-weight:bold;font-size:12px">1</div>
            </td>
            <td valign="top" style="padding-bottom:14px">
              <div style="color:#111827;font-size:14px;font-weight:700;margin-bottom:4px">
                Your listing is published
              </div>
              <div style="color:#64748b;font-size:13px;line-height:1.7">
                Buyers can now discover your equipment on the marketplace.
              </div>
            </td>
          </tr>

          <tr>
            <td width="34" valign="top">
              <div style="width:26px;height:26px;line-height:26px;text-align:center;border-radius:50%;background:#fffbeb;color:#b45309;font-weight:bold;font-size:12px">2</div>
            </td>
            <td valign="top">
              <div style="color:#111827;font-size:14px;font-weight:700;margin-bottom:4px">
                Stay ready for enquiries
              </div>
              <div style="color:#64748b;font-size:13px;line-height:1.7">
                Interested buyers may contact you to discuss pricing and availability.
              </div>
            </td>
          </tr>
        </table>
      </div>
    `
    : `
      <div style="margin-top:24px;padding:18px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px">
        <div style="margin-bottom:7px;color:#92400e;font-size:14px;font-weight:700">
          Need clarification?
        </div>
        <div style="color:#78350f;font-size:13px;line-height:1.8">
          Contact the EquipTrade India support team for guidance about your listing and the next steps.
        </div>
      </div>
    `;

  return sendEmail({
    to: email,
    subject,

    text: `Hello ${name || "Seller"},

${textUpdate}

Status: ${statusLabel}

${statusDescription}

${approved
        ? "Your equipment is now available for buyers to discover."
        : "Please contact EquipTrade India support if you need clarification."}

Regards,
Team EquipTrade India`,

    html: emailLayout({
      eyebrow: approved
        ? "LISTING APPROVED"
        : "LISTING REVIEW UPDATE",

      title,

      intro,

      body: `
        <!-- Status banner -->
        <div style="
          margin:24px 0;
          padding:20px;
          background:${statusBackground};
          border:1px solid ${statusBorder};
          border-radius:12px;
        ">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="44" valign="top">
                <div style="
                  width:32px;
                  height:32px;
                  line-height:32px;
                  text-align:center;
                  border-radius:50%;
                  background:#ffffff;
                  color:${statusColor};
                  font-size:19px;
                  font-weight:800;
                ">${statusIcon}</div>
              </td>

              <td valign="middle">
                <div style="
                  margin-bottom:5px;
                  color:${statusColor};
                  font-size:16px;
                  font-weight:800;
                  line-height:1.5;
                ">
                  ${statusLabel}
                </div>

                <div style="
                  color:${statusColor};
                  font-size:13px;
                  line-height:1.7;
                ">
                  ${statusDescription}
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Equipment details -->
        <div style="
          margin:25px 0;
          padding:22px;
          background:#f8fafc;
          border:1px solid #e2e8f0;
          border-radius:12px;
        ">
          <div style="
            margin-bottom:10px;
            color:#64748b;
            font-size:10px;
            font-weight:800;
            letter-spacing:1.5px;
          ">
            EQUIPMENT LISTING
          </div>

          <div style="
            margin-bottom:18px;
            color:#111827;
            font-size:20px;
            font-weight:700;
            line-height:1.5;
            overflow-wrap:anywhere;
          ">
            ${safeEquipmentName}
          </div>

          <div style="
            height:1px;
            background:#e2e8f0;
            margin-bottom:17px;
          "></div>

          <div style="
            margin-bottom:9px;
            color:#64748b;
            font-size:11px;
            font-weight:700;
            letter-spacing:1px;
          ">
            REVIEW RESULT
          </div>

          <span style="
            display:inline-block;
            padding:8px 12px;
            background:${statusBackground};
            border:1px solid ${statusBorder};
            border-radius:20px;
            color:${statusColor};
            font-size:12px;
            font-weight:700;
          ">
            ${statusLabel}
          </span>
        </div>

        <!-- Next steps -->
        ${nextSteps}

        <!-- Closing note -->
        <div style="
          margin-top:25px;
          padding:16px;
          background:#f8fafc;
          border-left:3px solid #f59e0b;
          border-radius:6px;
        ">
          <div style="
            margin-bottom:5px;
            color:#111827;
            font-size:13px;
            font-weight:700;
          ">
            ${approved
          ? "Thank you for selling with us"
          : "We're here to help"}
          </div>

          <div style="
            color:#64748b;
            font-size:13px;
            line-height:1.8;
          ">
            ${approved
          ? "Thank you for choosing EquipTrade India to connect with equipment buyers."
          : "If you have questions about this decision, please reach out to our support team."}
          </div>
        </div>
      `,

      footerNote: approved
        ? "Congratulations on listing your equipment with EquipTrade India."
        : "Need assistance? Contact EquipTrade India support.",
    }),
  });
}
