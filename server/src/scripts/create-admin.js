import 'dotenv/config'
import mongoose from 'mongoose'
import Admin from '../models/Admin.js'
import { env } from '../config/env.js'

const name = String(process.argv[2] || '').trim()
const password = String(process.argv[3] || '')

if (!name || password.length < 8) {
  console.error('Usage: npm run create-admin -- <admin-name> <password-minimum-8-characters>')
  process.exitCode = 1
} else {
  try {
    await mongoose.connect(env.mongoUri)
    await Admin.findOneAndUpdate(
      { name },
      { name, password },
      { upsert: true, setDefaultsOnInsert: true }
    )
    console.log(`Admin "${name}" saved to the database.`)
  } catch (error) {
    console.error(`Unable to save admin: ${error.message}`)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}
