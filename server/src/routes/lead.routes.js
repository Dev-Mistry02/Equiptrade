import { Router } from 'express'
import Lead from '../models/Lead.js'

const router = Router()
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

router.post('/', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    const email = String(req.body.email || '').trim().toLowerCase()
    const phone = String(req.body.phone || '').trim()
    const company = String(req.body.company || '').trim()
    const subject = String(req.body.subject || '').trim()
    const message = String(req.body.message || '').trim()
    const idempotencyKey = String(req.get('Idempotency-Key') || '').trim()

    if (
      !name ||
      name.length > 120 ||
      !EMAIL_PATTERN.test(email) ||
      email.length > 254 ||
      !subject ||
      subject.length > 200 ||
      !message ||
      message.length > 5000 ||
      phone.length > 30 ||
      company.length > 160 ||
      (phone && !/^[+()\d\s.-]{7,30}$/.test(phone)) ||
      idempotencyKey.length > 100
    ) {
      return res.status(400).json({
        message: 'Enter a valid name, email, subject, and message. Phone and company are optional.',
      })
    }

    if (idempotencyKey) {
      const existingLead = await Lead.findOne({ idempotencyKey }).select('leadId')
      if (existingLead) {
        return res.status(200).json({
          message: 'Your enquiry has already been submitted.',
          leadId: existingLead.leadId,
        })
      }
    }

    const lead = await Lead.create({
      name,
      email,
      phone,
      company,
      subject,
      message,
      idempotencyKey: idempotencyKey || undefined,
    })

    return res.status(201).json({
      message: 'Thank you for contacting EquipTrade India. Your enquiry has been submitted successfully. Our team will contact you soon.',
      leadId: lead.leadId,
    })
  } catch (error) {
    if (error?.code === 11000 && req.get('Idempotency-Key')) {
      try {
        const existingLead = await Lead.findOne({
          idempotencyKey: String(req.get('Idempotency-Key')).trim(),
        }).select('leadId')
        if (existingLead) {
          return res.status(200).json({
            message: 'Your enquiry has already been submitted.',
            leadId: existingLead.leadId,
          })
        }
      } catch (lookupError) {
        console.error('Failed to look up an existing enquiry submission:', lookupError)
      }
    }

    console.error('Failed to save contact enquiry:', error)
    return res.status(500).json({
      message: 'We could not submit your enquiry right now. Please try again shortly.',
    })
  }
})

export default router
