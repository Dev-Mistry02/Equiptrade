import { Router } from 'express'
import mongoose from 'mongoose'
import Equipment from '../models/Equipment.js'
import ServiceFeedback from '../models/ServiceFeedback.js'
import User from '../models/User.js'
import { requireUser } from '../middleware/userAuth.js'

const router = Router()

router.post('/', requireUser, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const equipmentId = String(req.body.equipmentId || '').trim()
    const rating = Number(req.body.rating)
    const message = String(req.body.message || '').trim()

    if (
      !mongoose.isValidObjectId(userId) ||
      !mongoose.isValidObjectId(equipmentId)
    ) {
      return res.status(400).json({ message: 'Invalid feedback reference.' })
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Choose a rating from 1 to 5.' })
    }

    if (!message || message.length > 2000) {
      return res.status(400).json({
        message: 'Enter a message of up to 2000 characters.',
      })
    }

    const [user, equipment] = await Promise.all([
      User.findOne({ _id: userId, verified: true }).select('name email'),
      Equipment.findOne({
        _id: equipmentId,
        status: { $in: ['approved', 'published'] },
      }).select('_id'),
    ])

    if (!user) {
      return res.status(401).json({
        message: 'A verified account is required to submit feedback.',
      })
    }

    if (!equipment) {
      return res.status(404).json({ message: 'Equipment listing not found.' })
    }

    const feedback = await ServiceFeedback.create({
      user: user._id,
      equipment: equipment._id,
      name: user.name || user.email,
      email: user.email,
      rating,
      message,
    })

    return res.status(201).json({
      message: 'Thank you for rating our services.',
      feedbackId: String(feedback._id),
    })
  } catch (error) {
    console.error('Failed to save service feedback:', error)
    return res.status(500).json({
      message: 'Unable to save your feedback. Please try again.',
    })
  }
})

export default router
