import { useRef, useState } from 'react'
import { ArrowRight, ClipboardCheck, LoaderCircle, ShieldCheck, Upload } from 'lucide-react'
import imageCompression from 'browser-image-compression'
import { z } from 'zod'
import { api } from '../api'

const numericInput = value => {
  if (typeof value !== 'string') return value
  const normalized = value.replace(/[₹,\s]/g, '').trim()
  return normalized ? Number(normalized) : undefined
}

const equipmentSchema = z.object({
  name: z.string().trim().min(1, 'Equipment name is required.'),
  category: z.string().trim().min(1, 'Category is required.'),
  brand: z.string().trim().min(1, 'Brand is required.'),
  model: z.string().trim().min(1, 'Model is required.'),
  year: z.preprocess(numericInput, z.number({ invalid_type_error: 'Enter a valid manufacturing year.' }).int().min(1900, 'Enter a valid manufacturing year.').max(new Date().getFullYear(), 'Manufacturing year cannot be in the future.')),
  condition: z.string().trim().min(1, 'Condition is required.'),
  price: z.preprocess(numericInput, z.number({ invalid_type_error: 'Enter a valid price.' }).positive('Price must be greater than zero.')),
  location: z.string().trim().min(1, 'Location is required.'),
  description: z.string().trim().min(10, 'Description must be at least 10 characters.')
})

export default function Sell({ notify, navigate, user }) {
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [images, setImages] = useState([])
  const fileInputRef = useRef(null)
  const [form, setForm] = useState({ name: '', category: '', brand: '', model: '', year: '', condition: '', price: '', location: '', description: '' })
  const update = event => { setError(''); setForm({ ...form, [event.target.name]: event.target.value }) }
  const selectImages = event => {
    const selectedFiles = Array.from(event.target.files || [])
    const invalidFile = selectedFiles.find(file => !file.type.startsWith('image/') || file.size > 10 * 1024 * 1024)
    if (invalidFile) {
      setError('Choose image files up to 10MB each.')
      event.target.value = ''
      return
    }
    if (selectedFiles.reduce((total, file) => total + file.size, images.reduce((total, image) => total + image.file.size, 0)) > 10 * 1024 * 1024) {
      setError('Keep the total image selection under 10MB.')
      event.target.value = ''
      return
    }
    const available = 8 - images.length
    const nextFiles = selectedFiles.slice(0, available).map(file => ({ file, url: URL.createObjectURL(file), dataUrl: '' }))
    setImages(current => [...current, ...nextFiles])
    setError(selectedFiles.length > available ? 'You can add up to 8 images.' : '')
    event.target.value = ''
  }
  const removeImage = url => {
    URL.revokeObjectURL(url)
    setImages(current => current.filter(image => image.url !== url))
  }
  const submit = async event => {
    event.preventDefault()
    if (!user?.id) { setError('Please verify your identity before submitting equipment.'); return }
    try {
      const parsed = equipmentSchema.safeParse(form)
      if (!parsed.success) { setError(parsed.error.issues[0].message); return }
      if (!images.length) { setError('Add at least one equipment image.'); return }
      setSubmitting(true)
      const cloudinaryImages = await Promise.all(images.map(image => uploadToCloudinary(image.file)))
      const response = await api.submitEquipment({ ...parsed.data, seller: user.id, images: cloudinaryImages })
      setSubmitted(true)
      notify(response.emailSent ? 'Request sent. Check your email for confirmation.' : 'Request sent. Email confirmation is logged in server development mode.')
    } catch (submitError) {
      setError(submitError.message || 'Unable to submit this equipment.')
    } finally {
      setSubmitting(false)
    }
  }
  const continueStep = event => {
    event.preventDefault()
    const requiredFields = step === 1
      ? ['name', 'category', 'brand', 'model', 'year', 'condition', 'price', 'location']
      : ['description']
    const missingField = requiredFields.find(field => !String(form[field]).trim())
    if (missingField) {
      setError('Please complete every field before continuing.')
      return
    }
    if (step < 3) setStep(step + 1)
    else submit(event)
  }
  const formattedPrice = numericInput(form.price)
  if (submitted) return <main className="container page success-page"><div className="success-icon"><ClipboardCheck size={30} /></div><span className="eyebrow">Submission received</span><h1>Your equipment is in<br />good hands.</h1><p>Our team is reviewing your details. Your listing will appear in the marketplace after it is verified.</p><div className="status-tracker"><span className="done"><b>✓</b>Submitted</span><i /><span className="current"><b>02</b>Under review</span><i /><span><b>03</b>Approved</span><i /><span><b>04</b>Published</span></div><button className="button button-dark" onClick={() => navigate('browse')}>Browse verified equipment <ArrowRight size={17} /></button></main>
  return <main className="container page sell-page"><div className="page-heading"><div><span className="eyebrow">Seller workspace</span><h1>Put your equipment<br /><em>back to work.</em></h1><p>Submit the details once. We’ll verify the listing before it reaches serious buyers.</p></div><div className="step-count">Step <strong>{step}</strong> of 3</div></div><div className="form-layout"><div className="form-progress"><span className={step >= 1 ? 'active' : ''}>01 <b>Equipment details</b></span><span className={step >= 2 ? 'active' : ''}>02 <b>Description & photos</b></span><span className={step >= 3 ? 'active' : ''}>03 <b>Review & submit</b></span></div><form className={`sell-form sell-form-step-${step}`} onSubmit={continueStep}>{step === 1 && <><FormIntro title="Tell us about the equipment" text="The essentials help buyers find the right match." /><div className="field-grid">{[['name','Equipment name','e.g. CNC Vertical Machining Center'],['brand','Brand','e.g. Haas'],['model','Model','e.g. VF-2'],['year','Manufacturing year','e.g. 2021'],['condition','Condition','Select condition'],['price','Expected price','₹ Enter amount'],['location','Location','City, State'],['category','Category','e.g. CNC & Machine Tools']].map(([name,label,placeholder]) => <label key={name}>{label}<input name={name} value={form[name]} onChange={update} placeholder={placeholder} required /></label>)}</div></>}{step === 2 && <><FormIntro title="Add context buyers can trust" text="Clear details and real images create confident enquiries." /><label className="full-field">Describe your equipment<textarea name="description" value={form.description} onChange={update} placeholder="Share condition, usage history, maintenance and important specifications..." required /></label><div className="upload-zone" onClick={() => fileInputRef.current?.click()}><input ref={fileInputRef} className="file-input" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={selectImages} /><Upload size={26} /><strong>Drop photos here or browse</strong><span>PNG, JPG or WEBP up to 10MB each · Add up to 8 images</span><button type="button" className="button button-outline" onClick={event => { event.stopPropagation(); fileInputRef.current?.click() }}>Choose images</button></div>{images.length > 0 && <div className="image-previews">{images.map(image => <div className="image-preview" key={image.url}><img src={image.url} alt="Selected equipment preview" /><button type="button" onClick={() => removeImage(image.url)} aria-label="Remove image">×</button></div>)}</div>}</>}{step === 3 && <><FormIntro title="Review your submission" text="Your listing will stay private until our team approves it." /><div className="product-review-card"><div className="product-review-media">{images.length ? <img src={images[0].url} alt={form.name || 'Equipment preview'} /> : <div className="product-review-placeholder"><Upload size={24} /><span>No equipment image selected</span></div>}<span className="listing-tag"><ShieldCheck size={13} /> Ready for review</span></div><div className="product-review-content"><div className="listing-meta"><span>{form.category}</span><span>{form.year}</span></div><h3>{form.name}</h3><p className="product-review-price">  {Number.isFinite(formattedPrice) ? `₹${formattedPrice.toLocaleString('en-IN')}` : 'Price on request'}</p><div className="product-review-facts"><span><b>Brand</b>{form.brand}</span><span><b>Model</b>{form.model}</span><span><b>Condition</b>{form.condition}</span><span><b>Location</b>{form.location}</span></div><p className="product-review-description">{form.description}</p>{images.length > 1 && <div className="product-review-thumbnails">{images.slice(1).map(image => <img key={image.url} src={image.url} alt="Additional equipment preview" />)}</div>}</div></div><div className="review-note"><ShieldCheck size={19} /><span>Your verified mobile number will be used for secure buyer enquiries. We never publish personal contact details.</span></div></>}{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions">{step > 1 && <button type="button" className="button button-ghost" onClick={() => { setError(''); setStep(step - 1) }}>Back</button>}<button className="button button-dark" type="submit" disabled={submitting}>{step === 3 ? 'Submit for verification' : 'Continue'} <ArrowRight size={17} /></button></div></form></div>{submitting && <div className="toast sell-mail-toast" role="status" aria-live="polite"><LoaderCircle className="action-spinner" size={18} /> Uploading images and sending request...</div>}</main>
}

function FormIntro({ title, text }) { return <div className="form-intro"><h2>{title}</h2><p>{text}</p></div> }



async function uploadToCloudinary(file) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) {
    throw new Error(
      'Cloudinary is not configured. Set the client Cloudinary environment variables.'
    )
  }

  // Compress image before uploading
  const options = {
    maxSizeMB: 1,           // Maximum compressed size
    maxWidthOrHeight: 1600, // Resize large phone/camera images
    useWebWorker: true,
    fileType: 'image/webp'
  }

  let optimizedFile = file

  try {
    optimizedFile = await imageCompression(file, options)

    console.log(
      `Original: ${(file.size / 1024 / 1024).toFixed(2)} MB`
    )

    console.log(
      `Optimized: ${(optimizedFile.size / 1024 / 1024).toFixed(2)} MB`
    )
  } catch (error) {
    console.warn('Image compression failed, uploading original file.', error)
  }

  const formData = new FormData()

  formData.append('file', optimizedFile)
  formData.append('upload_preset', uploadPreset)
  formData.append('folder', 'equiptrade/listings')

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData
    }
  )

  const data = await response.json()

  if (!response.ok || !data.secure_url) {
    throw new Error(
      data.error?.message || 'Unable to upload an image to Cloudinary.'
    )
  }

  return data.secure_url
}