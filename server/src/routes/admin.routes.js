import { Router } from 'express'
import mongoose from 'mongoose'

import Equipment from '../models/Equipment.js'
import Lead from '../models/Lead.js'
import { sendListingStatusEmail } from '../services/mailer.js'

import { requireAdmin } from '../middleware/adminAuth.js'

const router = Router()
const PLACEHOLDER_NAME_PATTERN = /(^|[\s_-])(hell|test|demo|dummy|sample|placeholder|asdf|qwerty)([\s_-]|$)/i

router.use(requireAdmin)

const LEAD_STATUSES = ['New', 'Contacted', 'In Progress', 'Converted', 'Closed']

router.get('/leads', async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20))
    const sortBy = ['createdAt', 'name', 'status'].includes(req.query.sortBy)
      ? req.query.sortBy
      : 'createdAt'
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1
    const query = {}

    if (req.query.status && LEAD_STATUSES.includes(String(req.query.status))) {
      query.status = String(req.query.status)
    }
    if (req.query.search) {
      const escapedSearch = String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (escapedSearch) {
        query.$or = ['leadId', 'name', 'email', 'phone', 'company', 'subject', 'message']
          .map(field => ({ [field]: new RegExp(escapedSearch, 'i') }))
      }
    }

    const [leads, total, statusCounts] = await Promise.all([
      Lead.find(query)
        .sort({ [sortBy]: sortOrder, _id: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Lead.countDocuments(query),
      Lead.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ])

    const counts = Object.fromEntries(statusCounts.map(item => [item._id, item.count]))
    res.set('Cache-Control', 'no-store')
    return res.json({
      leads,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      summary: {
        total: statusCounts.reduce((sum, item) => sum + item.count, 0),
        new: counts.New || 0,
        inProgress: counts['In Progress'] || 0,
        converted: counts.Converted || 0,
      },
    })
  } catch (error) {
    console.error('Failed to fetch contact leads:', error)
    return res.status(500).json({ message: 'Unable to load contact enquiries.' })
  }
})

router.patch('/leads/:id', async (req, res) => {
  try {
    const status = req.body.status === undefined ? undefined : String(req.body.status)
    const internalNotes = req.body.internalNotes === undefined
      ? undefined
      : String(req.body.internalNotes).trim()

    if (
      status === undefined && internalNotes === undefined ||
      status !== undefined && !LEAD_STATUSES.includes(status) ||
      internalNotes !== undefined && internalNotes.length > 10000
    ) {
      return res.status(400).json({ message: 'Provide a valid lead status or internal note.' })
    }

    const update = {}
    if (status !== undefined) update.status = status
    if (internalNotes !== undefined) update.internalNotes = internalNotes
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id },
      { $set: update },
      { new: true, runValidators: true }
    ).lean()

    if (!lead) return res.status(404).json({ message: 'Enquiry not found.' })
    return res.json(lead)
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid enquiry id.' })
    }
    console.error('Failed to update contact lead:', error)
    return res.status(500).json({ message: 'Unable to update this enquiry.' })
  }
})

// ==================================================
// GET ALL SUBMISSIONS
// ==================================================

router.get('/submissions', async (_req, res) => {
  try {
    // Prevent browser/proxy caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')

    await Equipment.updateMany(
      {
        name: PLACEHOLDER_NAME_PATTERN,
        isQualityHold: { $ne: true },
        isQualityReviewed: { $ne: true },
      },
      {
        $set: {
          isQualityHold: true,
          isActive: false,
          qualityReviewReason: 'Potential development or placeholder listing; review before republishing.',
        },
      }
    )

    const submissions = await Equipment
      .find()
      .sort({ createdAt: -1 })
      .populate('seller', 'name mobileNumber email')
      .lean()

    res.status(200).json(submissions.map(item => ({
      ...item,
      qualityReviewFlag: Boolean(
        item.isQualityHold ||
        (!item.isQualityReviewed && PLACEHOLDER_NAME_PATTERN.test(item.name || ''))
      ),
    })))

  } catch (error) {
    console.error('Failed to fetch submissions:', error)

    res.status(500).json({
      message: error.message || 'Failed to fetch submissions.',
    })
  }
})

router.patch('/submissions/:id/details', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid listing id.' })
    }

    const oemPartNumber = String(req.body.oemPartNumber || '').trim()
    if (oemPartNumber.length > 120) {
      return res.status(400).json({ message: 'OEM part number must be 120 characters or fewer.' })
    }

    const listing = await Equipment.findByIdAndUpdate(
      req.params.id,
      { $set: { oemPartNumber } },
      { new: true, runValidators: true }
    ).lean()

    if (!listing) {
      return res.status(404).json({ message: 'Equipment listing not found.' })
    }

    return res.status(200).json(listing)
  } catch (error) {
    console.error('Failed to update listing details:', error)
    return res.status(500).json({ message: 'Failed to update listing details.' })
  }
})

router.patch('/submissions/:id/quality-hold', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid listing id.' })
    }
    if (typeof req.body.isQualityHold !== 'boolean') {
      return res.status(400).json({ message: 'Choose whether the quality hold should remain active.' })
    }

    const update = req.body.isQualityHold
      ? {
          isQualityHold: true,
          isQualityReviewed: false,
          isActive: false,
          qualityReviewReason: 'Flagged for administrator quality review.',
        }
      : {
          isQualityHold: false,
          isQualityReviewed: true,
          isActive: true,
          qualityReviewReason: '',
        }
    const listing = await Equipment.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean()

    if (!listing) return res.status(404).json({ message: 'Equipment listing not found.' })
    return res.json({
      ...listing,
      qualityReviewFlag: listing.isQualityHold,
    })
  } catch (error) {
    console.error('Failed to update listing quality hold:', error)
    return res.status(500).json({ message: 'Unable to update listing quality review.' })
  }
})


// ==================================================
// UPDATE SUBMISSION STATUS
// ==================================================

router.patch('/submissions/:id/status', async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    // Validate MongoDB ID
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid listing id.',
      })
    }

    // Validate status
    const allowedStatuses = [
      'approved',
      'rejected',
    ]

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid submission status.',
      })
    }

    const verificationStatus =
      {
        approved: 'Approved',
        rejected: 'Rejected',
        changes_required: 'Changes Required',
        under_review: 'Under Review',
        published: 'Published',
      }[status] || 'Pending Verification'


    // ==================================================
    // UPDATE DATABASE FIRST
    // ==================================================

    const listing = await Equipment
      .findOneAndUpdate(
        {
          _id: id,
          status: 'pending',
        },
        {
          $set: {
            status,
            verificationStatus,
          },
        },
        {
          new: true,
          runValidators: true,
        }
      )
      .populate(
        'seller',
        'name mobileNumber email'
      )
      .lean()


    if (!listing) {
      return res.status(404).json({
        message:
          'Submission not found or already decided.',
      })
    }


    // ==================================================
    // RESPOND IMMEDIATELY
    // ==================================================

    let emailSent = false

    if (listing.seller?.email) {
      try {
        await sendListingStatusEmail(
          listing.seller.email,
          listing.seller.name,
          listing.name,
          status
        )
        emailSent = true
      } catch (error) {
        console.error('Failed to send listing decision email:', error)
      }
    }

    res.status(200).json({
      ...listing,
      emailSent,
    })

  } catch (error) {
    console.error(
      'Failed to update submission status:',
      error
    )

    /*
     * If response was already sent, don't try to
     * send another response.
     */
    if (!res.headersSent) {
      res.status(400).json({
        message:
          error.message ||
          'Failed to update submission status.',
      })
    }
  }
})


// ==================================================
// DELETE SUBMISSION
// ==================================================

router.delete('/submissions/:id', async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid listing id.',
      })
    }

    const listing =
      await Equipment.findOneAndDelete({
        _id: id,
      })

    if (!listing) {
      return res.status(404).json({
        message: 'Submission not found.',
      })
    }

    res.status(200).json({
      message: 'Listing deleted.',
      id: String(listing._id),
    })

  } catch (error) {
    console.error(
      'Failed to delete listing:',
      error
    )

    res.status(400).json({
      message:
        error.message ||
        'Failed to delete listing.',
    })
  }
})


export default router