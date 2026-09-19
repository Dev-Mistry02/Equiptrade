import { Router } from 'express'
import mongoose from 'mongoose'

import Equipment from '../models/Equipment.js'

import {
  sendListingApprovalEmail,
  sendListingRejectionEmail,
} from '../services/mailer.js'

import { requireAdmin } from '../middleware/adminAuth.js'

const router = Router()

router.use(requireAdmin)


// ==================================================
// GET ALL SUBMISSIONS
// ==================================================

router.get('/submissions', async (_req, res) => {
  try {
    // Prevent browser/proxy caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')

    const submissions = await Equipment
      .find()
      .sort({ createdAt: -1 })
      .populate('seller', 'name mobileNumber email')
      .lean()

    res.status(200).json(submissions)

  } catch (error) {
    console.error('Failed to fetch submissions:', error)

    res.status(500).json({
      message: error.message || 'Failed to fetch submissions.',
    })
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

    /*
     * IMPORTANT:
     *
     * Do NOT wait for the email before updating
     * the Admin UI.
     *
     * MongoDB is already updated at this point.
     */

    res.status(200).json({
      ...listing,
      emailSent: false,
    })


    // ==================================================
    // SEND EMAIL IN BACKGROUND
    // ==================================================

    const email = listing.seller?.email
    const sellerName = listing.seller?.name
    const equipmentName = listing.name

    if (email) {
      const sendEmail =
        status === 'approved'
          ? sendListingApprovalEmail(
              email,
              sellerName,
              equipmentName
            )
          : sendListingRejectionEmail(
              email,
              sellerName,
              equipmentName
            )

      sendEmail
        .then((emailSent) => {
          console.log(
            `${status} email result for ${email}:`,
            emailSent
          )
        })
        .catch((error) => {
          console.error(
            'Background email failed:',
            error.message
          )
        })
    }

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