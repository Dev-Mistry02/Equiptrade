import { Router } from 'express'
import Equipment from '../models/Equipment.js'
import mongoose from 'mongoose'
import { requireUser } from '../middleware/userAuth.js'
import {
  sendBuyerEnquiryEmails,
  sendListingSubmissionEmail,
} from '../services/mailer.js'

const router = Router()
const PUBLIC_LISTING_STATUSES = ['approved', 'published']
const PUBLIC_LISTING_FILTER = {
  status: { $in: PUBLIC_LISTING_STATUSES },
  isActive: { $ne: false },
  isQualityHold: { $ne: true },
  seller: { $exists: true, $ne: null },
  name: {
    $type: 'string',
    $ne: '',
    $regex: /\S/,
  },
  category: { $type: 'string', $ne: '', $regex: /\S/ },
  'images.0': /^https:\/\/res\.cloudinary\.com\/[^/\s]+\/image\/upload\/.+/,
}
const SURPLUS_INVENTORY_CONDITIONS = [
  'Surplus / Unused',
  'Excess Inventory',
  'Dead Stock',
]
const CATEGORY_GROUPS = [
  {
    name: 'DG Sets & Generators',
    aliases: ['DG Sets & Generators', 'DG Sets', 'DG Set', 'Generators', 'Power & Generators'],
  },
  {
    name: 'Power Transformers',
    aliases: ['Power Transformers', 'Transformers', 'Transformer'],
  },
  {
    name: 'Switchgear & HT Panels',
    aliases: ['Switchgear & HT Panels', 'Switchgear', 'HT Panels', 'Electrical Equipment'],
  },
  {
    name: 'Heavy Industrial Motors',
    aliases: ['Heavy Industrial Motors', 'Industrial Motors', 'Motors'],
  },
  {
    name: 'Industrial Plant Equipment',
    aliases: [
      'Industrial Plant Equipment',
      'Industrial Equipment',
      'Plant Equipment',
      'CNC & Machine Tools',
      'Construction Equipment',
      'Agricultural Equipment',
      'Material Handling Equipment',
      'Material Handling',
      'Welding Equipment',
      'Compressors',
      'Printing Equipment',
    ],
  },
  {
    name: 'MRO Spares & Components',
    aliases: ['MRO Spares & Components', 'MRO Spare Parts', 'MRO Spares', 'Spare Parts', 'Components'],
  },
  {
    name: 'Surplus / Dead Stock Equipment',
    aliases: [
      'Surplus / Dead Stock Equipment',
      'Surplus Industrial Machinery',
      'Surplus Equipment',
      'Dead Stock Equipment',
    ],
    inventoryConditions: SURPLUS_INVENTORY_CONDITIONS,
  },
]

const SEARCH_SYNONYMS = [
  ['dg set', ['diesel generator', 'diesel generator set']],
  ['dg sets', ['diesel generators', 'diesel generator sets']],
  ['diesel generator', ['dg set', 'diesel generator set']],
  ['diesel generators', ['dg sets', 'diesel generator sets']],
  ['diesel generator set', ['dg set', 'diesel generator']],
  ['diesel generator sets', ['dg sets', 'diesel generators']],
  ['transformer', ['power transformer', 'electrical transformer']],
  ['transformers', ['power transformers', 'electrical transformers']],
  ['power transformer', ['transformer', 'electrical transformer']],
  ['power transformers', ['transformers', 'electrical transformers']],
  ['electrical transformer', ['transformer', 'power transformer']],
  ['electrical transformers', ['transformers', 'power transformers']],
  ['ht panel', ['high tension panel', 'switchgear']],
  ['ht panels', ['high tension panels', 'switchgear']],
  ['high tension panel', ['ht panel', 'switchgear']],
  ['high tension panels', ['ht panels', 'switchgear']],
  ['switchgear', ['ht panel', 'high tension panel']],
  ['industrial motor', ['electric motor', 'heavy industrial motor']],
  ['industrial motors', ['electric motors', 'heavy industrial motors']],
  ['electric motor', ['industrial motor', 'heavy industrial motor']],
  ['electric motors', ['industrial motors', 'heavy industrial motors']],
  ['heavy industrial motor', ['industrial motor', 'electric motor']],
  ['heavy industrial motors', ['industrial motors', 'electric motors']],
  ['mro spares', ['maintenance, repair and operations spares']],
  ['maintenance, repair and operations spares', ['mro spares']],
]

function normalizeSearchInput(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function expandSearchSynonyms(search) {
  const candidates = new Set([search])
  const synonymEntries = [...SEARCH_SYNONYMS].sort(
    ([left], [right]) => right.length - left.length
  )
  for (const [phrase, synonyms] of synonymEntries) {
    const phrasePattern = new RegExp(
      `(^|[^a-z0-9])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}($|[^a-z0-9])`,
      'i'
    )
    if (!phrasePattern.test(search)) continue

    for (const synonym of synonyms) {
      candidates.add(search.replace(
        phrasePattern,
        (_, before, after) => `${before}${synonym}${after}`
      ))
    }
    break
  }

  return [...candidates]
}

function makeFlexiblePhrasePattern(phrase) {
  const tokens = phrase.split(' ').map(token =>
    token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  )
  return new RegExp(tokens.join('\\s*'), 'i')
}

function getCategoryFilter(category) {
  const definition = CATEGORY_GROUPS.find(item => item.name === category)
  if (!definition) return { category }

  const conditions = [{ category: { $in: definition.aliases } }]
  if (definition.inventoryConditions) {
    conditions.push({
      inventoryCondition: { $in: definition.inventoryConditions },
    })
  }
  return { $or: conditions }
}

router.get('/home', async (_req, res) => {
  try {
    const [summary] = await Equipment.aggregate([
      { $match: PUBLIC_LISTING_FILTER },
      {
        $facet: {
          listings: [
            { $sort: { createdAt: -1 } },
            { $limit: 4 },
            {
              $lookup: {
                from: 'users',
                localField: 'seller',
                foreignField: '_id',
                as: 'sellerInfo',
              },
            },
            {
              $set: {
                seller: { $arrayElemAt: ['$sellerInfo', 0] },
              },
            },
            {
              $project: {
                name: 1,
                category: 1,
                brand: 1,
                model: 1,
                oemPartNumber: 1,
                year: 1,
                condition: 1,
                inventoryCondition: 1,
                status: 1,
                verificationStatus: 1,
                listingType: 1,
                price: 1,
                location: 1,
                seller: {
                  name: '$seller.name',
                  verified: '$seller.verified',
                },
                images: { $slice: ['$images', 1] },
              },
            },
          ],
          ...Object.fromEntries(CATEGORY_GROUPS.map((category, index) => [
            `category${index}`,
            [
              { $match: getCategoryFilter(category.name) },
              { $count: 'count' },
            ],
          ])),
          total: [{ $count: 'count' }],
        },
      },
    ])

    res.set('Cache-Control', 'no-store')
    return res.json({
      listings: summary?.listings || [],
      categories: CATEGORY_GROUPS.map((category, index) => ({
        name: category.name,
        count: summary?.[`category${index}`]?.[0]?.count || 0,
      })),
      totalListings: summary?.total[0]?.count || 0,
    })
  } catch (error) {
    console.error('Failed to load home marketplace summary:', error)
    return res.status(500).json({
      message: 'Unable to load marketplace highlights. Please try again.',
    })
  }
})

router.get('/', async (req, res) => {
  try {
    const query = { ...PUBLIC_LISTING_FILTER }
    const andFilters = []

    if (req.query.search) {
      const search = normalizeSearchInput(req.query.search)
      if (search) {
        const patterns = expandSearchSynonyms(search).map(makeFlexiblePhrasePattern)
        andFilters.push({
          $or: ['name', 'model', 'description', 'brand', 'category', 'oemPartNumber'].map(field => ({
            $or: patterns.map(pattern => ({ [field]: pattern })),
          })),
        })
      }
    }

    if (req.query.category) andFilters.push(getCategoryFilter(String(req.query.category)))
    if (req.query.condition) query.condition = req.query.condition
    if (req.query.inventoryCondition) {
      const inventoryCondition = String(req.query.inventoryCondition)
      query.inventoryCondition = inventoryCondition === 'surplus'
        ? { $in: SURPLUS_INVENTORY_CONDITIONS }
        : inventoryCondition
    }

    if (req.query.oemPartNumber) {
      const partNumber = String(req.query.oemPartNumber).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      query.oemPartNumber = new RegExp(partNumber, 'i')
    }

    if (andFilters.length) query.$and = andFilters

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

    const sortOption = String(req.query.sort || 'newest')
    if (!['newest', 'price-asc', 'price-desc'].includes(sortOption)) {
      return res.status(400).json({ message: 'Invalid listing sort option.' })
    }
    const sort = sortOption === 'price-asc'
      ? { price: 1, createdAt: -1 }
      : sortOption === 'price-desc'
        ? { price: -1, createdAt: -1 }
        : { createdAt: -1 }
    let listings = await Equipment.find(query)
      .sort(sort)
      .populate('seller', 'name verified')
      .lean()

    if (sortOption.startsWith('price-')) {
      const direction = sortOption === 'price-asc' ? 1 : -1
      listings.sort((left, right) => {
        const leftHasPrice = Number.isFinite(left.price)
        const rightHasPrice = Number.isFinite(right.price)
        if (leftHasPrice !== rightHasPrice) return leftHasPrice ? -1 : 1
        if (leftHasPrice && left.price !== right.price) {
          return (left.price - right.price) * direction
        }
        return new Date(right.createdAt) - new Date(left.createdAt)
      })
    }

    res.json(listings)
  } catch (error) {
    res.status(500).json({
      message: error.message,
    })
  }
})

router.post('/:id/enquiries', requireUser, async (req, res) => {
  try {
    const { id } = req.params
    const name = String(req.body.name || '').trim()
    const email = String(req.user.email || '').trim().toLowerCase()
    const mobileNumber = String(req.body.mobileNumber || '').trim()
    const message = String(req.body.message || '').trim()

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid listing id.' })
    }

    if (
      !name ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !mobileNumber ||
      !message ||
      message.length > 5000
    ) {
      return res.status(400).json({
        message: 'Enter a valid name, email, mobile number and message (up to 5000 characters).',
      })
    }

    const listing = await Equipment.findOne({
      _id: id,
      ...PUBLIC_LISTING_FILTER,
    }).populate('seller', 'name email')

    if (!listing) {
      return res.status(404).json({ message: 'Equipment listing not found.' })
    }

    if (!listing.seller?.email) {
      return res.status(409).json({
        message: 'The seller has no email address available for enquiries.',
      })
    }

    const emailResults = await sendBuyerEnquiryEmails({
      sellerEmail: listing.seller.email,
      buyerEmail: email,
      buyerName: name,
      buyerMobileNumber: mobileNumber,
      message,
      equipmentName: listing.name,
    })

    if (!emailResults.sellerEmailSent) {
      console.error('Failed to email buyer enquiry to seller:', emailResults.sellerError)
      return res.status(502).json({
        message: 'Your enquiry could not be delivered to the seller. Please try again.',
      })
    }

    if (!emailResults.buyerConfirmationSent) {
      console.error('Failed to send buyer enquiry confirmation:', emailResults.buyerError)
    }

    res.status(200).json({
      message: 'Your enquiry was sent to the seller.',
      confirmationEmailSent: emailResults.buyerConfirmationSent,
    })
  } catch (error) {
    console.error('Failed to send buyer enquiry:', error)
    res.status(502).json({
      message: 'Your enquiry could not be emailed. Please check the mail configuration and try again.',
    })
  }
})

router.get('/:idOrSlug', async (req, res) => {
  try {
    const { idOrSlug } = req.params
    let item = null

    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      item = await Equipment.findOne({
        _id: idOrSlug,
        ...PUBLIC_LISTING_FILTER,
      }).populate('seller', 'name verified')
    }

    if (!item) {
      const all = await Equipment.find({
        ...PUBLIC_LISTING_FILTER,
      }).populate('seller', 'name verified')

      const target = decodeURIComponent(idOrSlug).toLowerCase().trim()
      item = all.find(e => {
        const slug = (e.name || '')
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
        const raw = (e.name || '').toLowerCase().trim()
        return (
          slug === target ||
          raw === target ||
          raw.replace(/\s+/g, '-') === target
        )
      })
    }

    if (!item) {
      return res.status(404).json({
        message: 'Equipment listing not found.',
      })
    }

    res.json(item)
  } catch (error) {
    res.status(500).json({
      message: error.message,
    })
  }
})

router.post('/', requireUser, async (req, res) => {
  try {
    const listingType = req.body.listingType || 'sale'

    if (!['sale', 'rental'].includes(listingType)) {
      return res.status(400).json({
        message: 'Choose whether this equipment is for sale or rent.',
      })
    }

    if (
      !Array.isArray(req.body.images) ||
      req.body.images.length < 3 ||
      req.body.images.some(
        image =>
          typeof image !== 'string' ||
          !/^https:\/\/res\.cloudinary\.com\/[^/\s]+\/image\/upload\/.+/.test(image)
      )
    ) {
      return res.status(400).json({
        message: 'Add at least 3 valid Cloudinary image URLs.',
      })
    }

    if (
      req.body.inventoryCondition &&
      !['Surplus / Unused', 'Excess Inventory', 'Dead Stock', 'Used Equipment'].includes(req.body.inventoryCondition)
    ) {
      return res.status(400).json({
        message: 'Choose a valid inventory condition.',
      })
    }

    const listingData = {
      ...req.body,
      listingType,
      seller: req.user.id,
      status: 'pending',
      verificationStatus: 'Pending Verification',
    }

    const listing = await Equipment.create(listingData)

    const seller = await listing.populate('seller', 'name email')
    let emailSent = false

    if (seller.seller?.email) {
      try {
        await sendListingSubmissionEmail(
          seller.seller.email,
          seller.seller.name,
          listing.name
        )
        emailSent = true
      } catch (error) {
        console.error('Failed to email listing submission confirmation:', error)
      }
    }

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