import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

const transporter = env.mailHost && env.mailUser
  ? nodemailer.createTransport({ host: env.mailHost, port: env.mailPort, secure: env.mailPort === 465, auth: { user: env.mailUser, pass: env.mailPassword } })
  : null

export async function sendOtpEmail(email, otp) {
  if (!transporter) {
    console.warn(`[development] OTP for ${email}: ${otp}`)
    return
  }
  await transporter.sendMail({
    from: env.mailFrom,
    to: email,
    subject: 'Your EquipTrade India verification code',
    text: `Your EquipTrade India verification code is ${otp}. It expires in 10 minutes.`,
    html: `<p>Your EquipTrade India verification code is:</p><h2 style="letter-spacing: 6px">${otp}</h2><p>This code expires in 10 minutes.</p>`
  })
}

export async function sendListingSubmissionEmail(email, name, equipmentName) {
  if (!email) throw new Error('Seller email is missing; submission email was not sent.')
  if (!transporter) {
    console.warn(`[development] Submission email for ${email}: ${equipmentName}`)
    return false
  }
  await transporter.sendMail({
  from: env.mailFrom,
  to: email,
  subject: 'Your EquipTrade India listing has been submitted',
  text: `Hello ${name || 'Seller'},

Your equipment listing "${equipmentName}" has been successfully submitted to EquipTrade India and is currently awaiting verification.

Our team will review your listing shortly. Once it has been verified and approved, it will become visible to potential buyers on the platform.

Thank you for choosing EquipTrade India.

Best regards,
EquipTrade India Team
www.equiptradeindia.com`,

  html: `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Listing Submitted - EquipTrade India</title>
    </head>

    <body style="
      margin: 0;
      padding: 0;
      background-color: #f4f6f8;
      font-family: Arial, Helvetica, sans-serif;
      color: #1f2937;
    ">

      <table width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background-color: #f4f6f8; padding: 40px 15px;">
        <tr>
          <td align="center">

            <!-- Main Container -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
              style="
                max-width: 600px;
                background-color: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 18px rgba(0,0,0,0.08);
              ">

              <!-- Header -->
              <tr>
                <td style="
                  background-color: #111827;
                  padding: 28px 35px;
                  text-align: center;
                ">
                  <h1 style="
                    margin: 0;
                    color: #ffffff;
                    font-size: 24px;
                    font-weight: 700;
                  ">
                    EquipTrade India
                  </h1>

                  <p style="
                    margin: 8px 0 0;
                    color: #d1d5db;
                    font-size: 13px;
                  ">
                    Buy & Sell Equipment with Confidence
                  </p>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 35px;">

                  <h2 style="
                    margin: 0 0 18px;
                    font-size: 22px;
                    color: #111827;
                  ">
                    Listing Submitted Successfully
                  </h2>

                  <p style="
                    margin: 0 0 18px;
                    font-size: 15px;
                    line-height: 1.7;
                    color: #4b5563;
                  ">
                    Hello <strong>${name || 'Seller'}</strong>,
                  </p>

                  <p style="
                    margin: 0 0 25px;
                    font-size: 15px;
                    line-height: 1.7;
                    color: #4b5563;
                  ">
                    Thank you for submitting your equipment listing on
                    <strong>EquipTrade India</strong>.
                    Your listing has been successfully received and is
                    currently awaiting verification by our team.
                  </p>

                  <!-- Listing Card -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"
                    style="
                      background-color: #f9fafb;
                      border: 1px solid #e5e7eb;
                      border-radius: 8px;
                      margin-bottom: 25px;
                    ">
                    <tr>
                      <td style="padding: 20px;">

                        <p style="
                          margin: 0 0 8px;
                          font-size: 12px;
                          color: #6b7280;
                          text-transform: uppercase;
                          letter-spacing: 0.5px;
                          font-weight: 600;
                        ">
                          Equipment Listing
                        </p>

                        <p style="
                          margin: 0;
                          font-size: 17px;
                          font-weight: 700;
                          color: #111827;
                        ">
                          ${equipmentName}
                        </p>

                        <p style="
                          margin: 12px 0 0;
                          font-size: 13px;
                          color: #d97706;
                          font-weight: 600;
                        ">
                          ● Awaiting Verification
                        </p>

                      </td>
                    </tr>
                  </table>

                  <p style="
                    margin: 0 0 18px;
                    font-size: 14px;
                    line-height: 1.7;
                    color: #4b5563;
                  ">
                    Our team will review the details of your listing shortly.
                    Once it has been verified and approved, your equipment
                    will be made visible to potential buyers on the platform.
                  </p>

                  <p style="
                    margin: 0;
                    font-size: 14px;
                    line-height: 1.7;
                    color: #4b5563;
                  ">
                    We appreciate your trust in
                    <strong>EquipTrade India</strong>.
                  </p>

                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 0 35px;">
                  <div style="
                    height: 1px;
                    background-color: #e5e7eb;
                  "></div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="
                  padding: 25px 35px;
                  text-align: center;
                  background-color: #fafafa;
                ">

                  <p style="
                    margin: 0 0 8px;
                    font-size: 14px;
                    font-weight: 700;
                    color: #111827;
                  ">
                    EquipTrade India
                  </p>

                  <p style="
                    margin: 0 0 12px;
                    font-size: 12px;
                    color: #6b7280;
                    line-height: 1.6;
                  ">
                    Your trusted platform for buying and selling equipment.
                  </p>

                  <p style="
                    margin: 0;
                    font-size: 12px;
                    color: #9ca3af;
                  ">
                    © ${new Date().getFullYear()} EquipTrade India. All rights reserved.
                  </p>

                </td>
              </tr>

            </table>

          </td>
        </tr>
      </table>

    </body>
  </html>
  `
});
  return true
}

export async function sendListingApprovalEmail(email, name, equipmentName) {
  if (!email) throw new Error('Seller email is missing; approval email was not sent.')
  if (!transporter) {
    console.warn(`[development] Approval email for ${email}: ${equipmentName}`)
    return false
  }
  await transporter.sendMail({
  from: env.mailFrom,
  to: email,
  subject: 'Your EquipTrade India listing is now live',
  
  text: `Hello ${name || 'Seller'},

Great news! Your equipment listing "${equipmentName}" has been successfully verified and approved by EquipTrade India.

Your listing is now live and visible to potential buyers on the platform.

Thank you for choosing EquipTrade India.

Best regards,
EquipTrade India Team
www.equiptradeindia.com`,

  html: `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Listing Approved - EquipTrade India</title>
    </head>

    <body style="
      margin: 0;
      padding: 0;
      background-color: #f4f6f8;
      font-family: Arial, Helvetica, sans-serif;
      color: #1f2937;
    ">

      <table width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background-color: #f4f6f8; padding: 40px 15px;">
        <tr>
          <td align="center">

            <!-- Main Container -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
              style="
                max-width: 600px;
                background-color: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 18px rgba(0,0,0,0.08);
              ">

              <!-- Header -->
              <tr>
                <td style="
                  background-color: #111827;
                  padding: 28px 35px;
                  text-align: center;
                ">

                  <h1 style="
                    margin: 0;
                    color: #ffffff;
                    font-size: 24px;
                    font-weight: 700;
                  ">
                    EquipTrade India
                  </h1>

                  <p style="
                    margin: 8px 0 0;
                    color: #d1d5db;
                    font-size: 13px;
                  ">
                    Buy & Sell Equipment with Confidence
                  </p>

                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 35px;">

                  <!-- Success Icon -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" style="padding-bottom: 20px;">

                        <div style="
                          width: 58px;
                          height: 58px;
                          line-height: 58px;
                          border-radius: 50%;
                          background-color: #dcfce7;
                          color: #16a34a;
                          font-size: 30px;
                          font-weight: bold;
                          margin: 0 auto;
                        ">
                          ✓
                        </div>

                      </td>
                    </tr>
                  </table>

                  <h2 style="
                    margin: 0 0 18px;
                    text-align: center;
                    font-size: 23px;
                    color: #111827;
                  ">
                    Your Listing Is Approved!
                  </h2>

                  <p style="
                    margin: 0 0 18px;
                    font-size: 15px;
                    line-height: 1.7;
                    color: #4b5563;
                  ">
                    Hello <strong>${name || 'Seller'}</strong>,
                  </p>

                  <p style="
                    margin: 0 0 25px;
                    font-size: 15px;
                    line-height: 1.7;
                    color: #4b5563;
                  ">
                    Great news! Your equipment listing has been successfully
                    reviewed and approved by the
                    <strong>EquipTrade India</strong> team.
                  </p>

                  <!-- Listing Card -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"
                    style="
                      background-color: #f9fafb;
                      border: 1px solid #e5e7eb;
                      border-radius: 8px;
                      margin-bottom: 25px;
                    ">
                    <tr>
                      <td style="padding: 20px;">

                        <p style="
                          margin: 0 0 8px;
                          font-size: 12px;
                          color: #6b7280;
                          text-transform: uppercase;
                          letter-spacing: 0.5px;
                          font-weight: 600;
                        ">
                          Equipment Listing
                        </p>

                        <p style="
                          margin: 0 0 12px;
                          font-size: 17px;
                          font-weight: 700;
                          color: #111827;
                        ">
                          ${equipmentName}
                        </p>

                        <p style="
                          margin: 0;
                          font-size: 13px;
                          color: #16a34a;
                          font-weight: 700;
                        ">
                          ✓ Approved & Live
                        </p>

                      </td>
                    </tr>
                  </table>

                  <p style="
                    margin: 0 0 18px;
                    font-size: 14px;
                    line-height: 1.7;
                    color: #4b5563;
                  ">
                    Your listing is now <strong>live on EquipTrade India</strong>
                    and can be viewed by potential buyers looking for
                    equipment on our platform.
                  </p>

                  <p style="
                    margin: 0;
                    font-size: 14px;
                    line-height: 1.7;
                    color: #4b5563;
                  ">
                    Thank you for choosing
                    <strong>EquipTrade India</strong> to sell your equipment.
                    We wish you a successful sale!
                  </p>

                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding: 0 35px;">
                  <div style="
                    height: 1px;
                    background-color: #e5e7eb;
                  "></div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="
                  padding: 25px 35px;
                  text-align: center;
                  background-color: #fafafa;
                ">

                  <p style="
                    margin: 0 0 8px;
                    font-size: 14px;
                    font-weight: 700;
                    color: #111827;
                  ">
                    EquipTrade India
                  </p>

                  <p style="
                    margin: 0 0 12px;
                    font-size: 12px;
                    color: #6b7280;
                    line-height: 1.6;
                  ">
                    Your trusted platform for buying and selling equipment.
                  </p>

                  <p style="
                    margin: 0;
                    font-size: 12px;
                    color: #9ca3af;
                  ">
                    © ${new Date().getFullYear()} EquipTrade India.
                    All rights reserved.
                  </p>

                </td>
              </tr>

            </table>

          </td>
        </tr>
      </table>

    </body>
  </html>
  `
});
  return true
}

export async function sendListingRejectionEmail(email, name, equipmentName) {
  if (!email) throw new Error('Seller email is missing; rejection email was not sent.')
  if (!transporter) {
    console.warn(`[development] Rejection email for ${email}: ${equipmentName}`)
    return false
  }

  await transporter.sendMail({
    from: env.mailFrom,
    to: email,
    subject: 'Update on your EquipTrade India listing',
    text: `Hello ${name || 'Seller'},

Thank you for submitting "${equipmentName}" to EquipTrade India.

After review, our team was unable to approve this listing for publication at this time. The listing will not be visible to buyers on the platform.

If you believe this decision was made in error or would like guidance on updating the listing, please contact our support team.

Best regards,
EquipTrade India Team
www.equiptradeindia.com`,
    html: `
      <div style="margin:0;padding:32px 16px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
        <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.08)">
          <div style="padding:28px 35px;background:#111827;color:#fff">
            <div style="font-size:20px;font-weight:700">EquipTrade <span style="color:#f3c760">India</span></div>
            <div style="margin-top:8px;color:#cbd5e1;font-size:13px">Listing review update</div>
          </div>
          <div style="padding:32px 35px">
            <p style="margin:0 0 16px;font-size:16px">Hello ${name || 'Seller'},</p>
            <p style="margin:0 0 18px;color:#4b5563;font-size:15px;line-height:1.7">
              Thank you for submitting <strong>${equipmentName}</strong> to EquipTrade India.
            </p>
            <p style="margin:0 0 18px;color:#4b5563;font-size:15px;line-height:1.7">
              After review, our team was unable to approve this listing for publication at this time. The listing will not be visible to buyers on the platform.
            </p>
            <p style="margin:0;color:#4b5563;font-size:15px;line-height:1.7">
              If you believe this decision was made in error or would like guidance on updating the listing, please contact our support team.
            </p>
          </div>
          <div style="padding:22px 35px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.6">
            EquipTrade India<br />
            Your trusted platform for buying and selling equipment.
          </div>
        </div>
      </div>
    `
  })

  return true
}