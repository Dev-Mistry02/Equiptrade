import { Router } from 'express'
import Equipment from '../models/Equipment.js'
import User from '../models/User.js'
import { sendListingSubmissionEmail } from '../services/mailer.js'
import { requireUser } from '../middleware/userAuth.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const query = { status: { $in: ['approved', 'published'] } }

    if (req.query.search) {
      const search = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      query.$or = ['name', 'category', 'brand', 'model', 'location'].map(field => ({
        [field]: new RegExp(search, 'i'),
      }))
    }

    if (req.query.category) query.category = req.query.category
    if (req.query.condition) query.condition = req.query.condition

    if (req.query.location) {
      query.location = new RegExp(
        String(req.query.location).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      )
    }

    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {}

      if (req.query.minPrice) {
        const minPrice = Number(req.query.minPrice)

        if (!Number.isFinite(minPrice) || minPrice < 0) {
          return res.status(400).json({
            message: 'Invalid minimum price filter.',
          })
        }

        query.price.$gte = minPrice
      }

      if (req.query.maxPrice) {
        const maxPrice = Number(req.query.maxPrice)

        if (!Number.isFinite(maxPrice) || maxPrice < 0) {
          return res.status(400).json({
            message: 'Invalid maximum price filter.',
          })
        }

        query.price.$lte = maxPrice
      }
    }

    const listings = await Equipment.find(query)
      .sort({ createdAt: -1 })
      .populate('seller', 'name')

    res.json(listings)
  } catch (error) {
    res.status(500).json({
      message: error.message,
    })
  }
})

router.post('/', requireUser, async (req, res) => {
  try {
    if (
      !Array.isArray(req.body.images) ||
      !req.body.images.length ||
      req.body.images.some(
        image =>
          typeof image !== 'string' ||
          !/^https:\/\/res\.cloudinary\.com\/[^/\s]+\/image\/upload\/.+/.test(image)
      )
    ) {
      return res.status(400).json({
        message: 'Add at least one valid Cloudinary image URL.',
      })
    }

    const listingData = {
      ...req.body,
      seller: req.user.id,
      status: 'pending',
      verificationStatus: 'Pending Verification',
    }

    const listing = await Equipment.create(listingData)

    const seller = await User.findById(listing.seller).select('name email')

    const emailSent = await sendListingSubmissionEmail(
      seller?.email,
      seller?.name,
      listing.name
    )

    res.status(201).json({
      ...listing.toObject(),
      emailSent,
    })
  } catch (error) {
    res.status(400).json({
      message: error.message,
    })
  }
})

export default router