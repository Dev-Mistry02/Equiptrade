import { useRef, useState } from 'react'
import {
  ArrowRight,
  ClipboardCheck,
  LoaderCircle,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import imageCompression from 'browser-image-compression'
import { z } from 'zod'
import { api } from '../api'

const numericInput = value => {
  if (typeof value !== 'string') return value

  const normalized = value.replace(/[₹,\s]/g, '').trim()

  return normalized ? Number(normalized) : undefined
}

const CONDITION_OPTIONS = [
  'Like New',
  'Excellent',
  'Good',
  'Fair',
  'Needs Repair',
]

const CATEGORY_OPTIONS = [
  'CNC & Machine Tools',
  'Construction Equipment',
  'Agricultural Equipment',
  'Material Handling Equipment',
  'Industrial Equipment',
  'Electrical Equipment',
  'Welding Equipment',
  'Compressors',
  'Generators',
  'Printing Equipment',
  'Other',
]

const equipmentSchema = z.object({
  listingType: z.enum(['sale', 'rental'], {
    required_error: 'Choose whether you want to sell or rent this equipment.',
  }),

  name: z
    .string()
    .trim()
    .min(1, 'Equipment name is required.'),

  category: z
    .string()
    .trim()
    .min(1, 'Category is required.'),

  brand: z
    .string()
    .trim()
    .min(1, 'Brand is required.'),

  model: z
    .string()
    .trim()
    .min(1, 'Model is required.'),

  year: z.preprocess(
    numericInput,
    z
      .number({
        invalid_type_error:
          'Enter a valid manufacturing year.',
      })
      .int()
      .min(
        1900,
        'Enter a valid manufacturing year.'
      )
      .max(
        new Date().getFullYear(),
        'Manufacturing year cannot be in the future.'
      )
  ),

  condition: z
    .string()
    .trim()
    .min(1, 'Condition is required.'),

  price: z.preprocess(
    numericInput,
    z
      .number({
        invalid_type_error: 'Enter a valid price.',
      })
      .positive(
        'Price must be greater than zero.'
      )
  ),

  location: z
    .string()
    .trim()
    .min(1, 'Location is required.'),

  description: z
    .string()
    .trim()
    .min(
      10,
      'Description must be at least 10 characters.'
    ),
})

export default function Sell({
  notify,
  navigate,
  user,
}) {
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [images, setImages] = useState([])

  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    listingType: 'sale',
    name: '',
    category: '',
    brand: '',
    model: '',
    year: '',
    condition: '',
    price: '',
    location: '',
    description: '',
  })


  // =========================================================
  // FORM UPDATE
  // =========================================================

  const update = event => {
    setError('')

    setForm({
      ...form,
      [event.target.name]: event.target.value,
    })
  }

  // =========================================================
  // SELECT IMAGES
  // MINIMUM 3
  // MAXIMUM 4
  // =========================================================

  const selectImages = event => {
    const selectedFiles = Array.from(
      event.target.files || []
    )

    if (!selectedFiles.length) return

    // -------------------------------------------------------
    // MAXIMUM 4 IMAGES
    // -------------------------------------------------------

    if (images.length + selectedFiles.length > 4) {
      setError(
        `You can upload a maximum of 4 different images. You currently have ${images.length} image${images.length !== 1 ? 's' : ''
        } selected.`
      )

      event.target.value = ''
      return
    }

    // -------------------------------------------------------
    // VALIDATE FILE TYPE AND SIZE
    // -------------------------------------------------------

    const invalidFile = selectedFiles.find(
      file =>
        !file.type.startsWith('image/') ||
        file.size > 10 * 1024 * 1024
    )

    if (invalidFile) {
      setError(
        'Choose image files up to 10MB each.'
      )

      event.target.value = ''
      return
    }

    // -------------------------------------------------------
    // PREVENT SAME FILE FROM BEING SELECTED AGAIN
    // -------------------------------------------------------

    const existingFiles = images.map(
      image => image.file
    )

    const duplicateFile = selectedFiles.find(
      file =>
        existingFiles.some(
          existing =>
            existing.name === file.name &&
            existing.size === file.size &&
            existing.lastModified ===
            file.lastModified
        )
    )

    if (duplicateFile) {
      setError(
        `"${duplicateFile.name}" is already selected. Please choose a different image.`
      )

      event.target.value = ''
      return
    }

    // -------------------------------------------------------
    // CHECK TOTAL SIZE
    // -------------------------------------------------------

    const currentTotalSize = images.reduce(
      (total, image) =>
        total + image.file.size,
      0
    )

    const newTotalSize = selectedFiles.reduce(
      (total, file) => total + file.size,
      0
    )

    if (
      currentTotalSize + newTotalSize >
      10 * 1024 * 1024
    ) {
      setError(
        'Keep the total image selection under 10MB.'
      )

      event.target.value = ''
      return
    }

    // -------------------------------------------------------
    // CREATE IMAGE PREVIEWS
    // -------------------------------------------------------

    const nextFiles = selectedFiles.map(file => ({
      file,
      url: URL.createObjectURL(file),
      dataUrl: '',
    }))

    setImages(current => [
      ...current,
      ...nextFiles,
    ])

    setError('')

    // Reset input
    event.target.value = ''
  }

  // =========================================================
  // REMOVE IMAGE
  // =========================================================

  const removeImage = url => {
    URL.revokeObjectURL(url)

    setImages(current =>
      current.filter(
        image => image.url !== url
      )
    )

    setError('')
  }

  // =========================================================
  // SUBMIT
  // =========================================================

  const submit = async event => {
    event.preventDefault()

    if (!user?.id) {
      setError(
        'Please verify your identity before submitting equipment.'
      )

      return
    }

    try {
      // -----------------------------------------------------
      // VALIDATE FORM
      // -----------------------------------------------------

      const parsed =
        equipmentSchema.safeParse(form)

      if (!parsed.success) {
        setError(
          parsed.error.issues[0].message
        )

        return
      }

      // -----------------------------------------------------
      // VALIDATE IMAGE COUNT
      // MUST BE 3 OR 4
      // -----------------------------------------------------

      if (
        images.length < 3 ||
        images.length > 4
      ) {
        setError(
          `Please upload 3 to 4 different equipment images. Currently ${images.length} image${images.length !== 1 ? 's' : ''
          } selected.`
        )

        return
      }

      setSubmitting(true)

      // -----------------------------------------------------
      // UPLOAD ALL IMAGES TO CLOUDINARY
      // -----------------------------------------------------

      const cloudinaryImages =
        await Promise.all(
          images.map(image =>
            uploadToCloudinary(image.file)
          )
        )

      // -----------------------------------------------------
      // SUBMIT EQUIPMENT
      // -----------------------------------------------------

      const response =
        await api.submitEquipment({
          ...parsed.data,
          seller: user.id,
          images: cloudinaryImages,
        })

      setSubmitted(true)

      notify(
        response.emailSent
          ? 'Request sent. A confirmation email was sent.'
          : 'Request sent, but the confirmation email could not be sent.'
      )
    } catch (submitError) {
      setError(
        submitError.message ||
        'Unable to submit this equipment.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // =========================================================
  // CONTINUE TO NEXT STEP
  // =========================================================

  const continueStep = event => {
    event.preventDefault()

    const requiredFields =
      step === 1
        ? [
          'name',
          'category',
          'brand',
          'model',
          'year',
          'condition',
          'price',
          'location',
        ]
        : ['description']

    const missingField =
      requiredFields.find(
        field =>
          !String(form[field]).trim()
      )

    if (missingField) {
      setError(
        'Please complete every field before continuing.'
      )

      return
    }

    // -------------------------------------------------------
    // STEP 2 IMAGE VALIDATION
    // -------------------------------------------------------

    if (
      step === 2 &&
      (images.length < 3 ||
        images.length > 4)
    ) {
      setError(
        `Compulsory: Upload 3 to 4 different images (${images.length}/4 selected).`
      )

      return
    }

    if (step < 3) {
      setStep(step + 1)
    } else {
      submit(event)
    }
  }

  const formattedPrice =
    numericInput(form.price)

  // =========================================================
  // SUCCESS PAGE
  // =========================================================

  if (submitted) {
    return (
      <main className="container page success-page">
        <div className="success-icon">
          <ClipboardCheck size={30} />
        </div>

        <span className="eyebrow">
          Submission received
        </span>

        <h1>
          Your equipment is in
          <br />
          good hands.
        </h1>

        <p>
          Our team is reviewing your details.
          Your listing will appear in the
          marketplace after it is verified.
        </p>

        <div className="status-tracker">
          <span className="done">
            <b>✓</b>
            Submitted
          </span>

          <i />

          <span className="current">
            <b>02</b>
            Under review
          </span>

          <i />

          <span>
            <b>03</b>
            Approved
          </span>

          <i />

          <span>
            <b>04</b>
            Published
          </span>
        </div>

        <button
          className="button button-dark"
          onClick={() => navigate('browse')}
        >
          Browse verified equipment
          <ArrowRight size={17} />
        </button>
      </main>
    )
  }

  // =========================================================
  // MAIN SELL PAGE
  // =========================================================

  return (
    <main className="container page sell-page">

      {/* PAGE HEADING */}

      <div className="page-heading">
        <div>
          <span className="eyebrow">
            Seller workspace
          </span>

          <h1>
            Put your equipment
            <br />
            <em>back to work.</em>
          </h1>

          <p>
            Submit the details once. We’ll
            verify the listing before it
            reaches serious buyers.
          </p>
        </div>

        <div className="step-count">
          Step <strong>{step}</strong> of 3
        </div>
      </div>

      <div className="form-layout">

        <div className="form-progress">
          <span
            className={
              step >= 1 ? 'active' : ''
            }
          >
            01
            <b>Equipment details</b>
          </span>

          <span
            className={
              step >= 2 ? 'active' : ''
            }
          >
            02
            <b>Description & photos</b>
          </span>

          <span
            className={
              step >= 3 ? 'active' : ''
            }
          >
            03
            <b>Review & submit</b>
          </span>
        </div>

        <form
          className={`sell-form sell-form-step-${step}`}
          onSubmit={continueStep}
        >

          {/* =================================================
              STEP 1
          ================================================= */}

          {step === 1 && (
            <>
              <FormIntro
                title="Tell us about the equipment"
                text="The essentials help buyers find the right match."
              />

              <div className="field-grid">

                <fieldset className="listing-type-field" aria-required="true">
                  <legend>Listing type</legend>
                  <div className="listing-type-options">
                    <label
                      className={`listing-type-option ${form.listingType === 'sale' ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="listingType"
                        value="sale"
                        checked={form.listingType === 'sale'}
                        required
                        onChange={update}
                      />
                      <span>Sell</span>
                    </label>
                    <label
                      className={`listing-type-option ${form.listingType === 'rental' ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="listingType"
                        value="rental"
                        checked={form.listingType === 'rental'}
                        onChange={update}
                      />
                      <span>Rent</span>
                    </label>
                  </div>
                </fieldset>

                {/* Equipment Name */}
                <label>
                  Equipment name

                  <input
                    name="name"
                    value={form.name}
                    onChange={update}
                    placeholder="e.g. CNC Vertical Machining Center"
                    required
                  />
                </label>

                {/* Brand */}
                <label>
                  Brand

                  <input
                    name="brand"
                    value={form.brand}
                    onChange={update}
                    placeholder="e.g. Haas"
                    required
                  />
                </label>

                {/* Model */}
                <label>
                  Model

                  <input
                    name="model"
                    value={form.model}
                    onChange={update}
                    placeholder="e.g. VF-2"
                    required
                  />
                </label>

                {/* Manufacturing Year */}
                <label>
                  Manufacturing year

                  <input
                    type="number"
                    name="year"
                    value={form.year}
                    onChange={update}
                    placeholder="e.g. 2021"
                    min="1900"
                    max={new Date().getFullYear()}
                    required
                  />
                </label>

                {/* CONDITION DROPDOWN */}
                <label>
                  Condition

                  <select
                    name="condition"
                    value={form.condition}
                    onChange={update}
                    required
                  >
                    <option value="" disabled>
                      Select condition
                    </option>

                    {CONDITION_OPTIONS.map(condition => (
                      <option
                        key={condition}
                        value={condition}
                      >
                        {condition}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Price */}
                <label>
                  {form.listingType === 'rental'
                    ? 'Rental price'
                    : 'Expected sale price'}

                  <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={update}
                    placeholder="₹ Enter amount"
                    min="1"
                    required
                  />
                </label>

                {/* Location */}
                <label>
                  Location

                  <input
                    name="location"
                    value={form.location}
                    onChange={update}
                    placeholder="City, State"
                    required
                  />
                </label>

                {/* CATEGORY DROPDOWN */}
                <label>
                  Category

                  <select
                    name="category"
                    value={form.category}
                    onChange={update}
                    required
                  >
                    <option value="" disabled>
                      Select category
                    </option>

                    {CATEGORY_OPTIONS.map(category => (
                      <option
                        key={category}
                        value={category}
                      >
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

              </div>
            </>
          )}

          {/* =================================================
              STEP 2
          ================================================= */}

          {step === 2 && (
            <>
              <FormIntro
                title="Add context buyers can trust"
                text="Clear details and real images create confident enquiries. Upload 3 to 4 different images of your equipment."
              />

              <label className="full-field">
                Describe your equipment

                <textarea
                  name="description"
                  value={form.description}
                  onChange={update}
                  placeholder="Share condition, usage history, maintenance and important specifications..."
                  required
                />
              </label>

              {/* IMAGE UPLOAD */}

              <div
                className="upload-zone"
                onClick={() =>
                  fileInputRef.current?.click()
                }
              >
                <input
                  ref={fileInputRef}
                  className="file-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={selectImages}
                />

                <Upload size={26} />

                <strong>
                  Drop photos here or browse
                </strong>

                <span>
                  PNG, JPG or WEBP up to
                  10MB each ·{' '}
                  <b>
                    Compulsory: 3–4
                    different images
                  </b>{' '}
                  · Maximum 4
                </span>

                {/* IMAGE COUNT */}

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color:
                      images.length >= 3 &&
                        images.length <= 4
                        ? '#277258'
                        : '#b44e4e',
                  }}
                >
                  {images.length >= 3 &&
                    images.length <= 4
                    ? `✓ ${images.length}/4 different images added`
                    : `* Compulsory: Add 3–4 different images (${images.length}/4)`}
                </div>

                {/* CHOOSE IMAGE BUTTON */}

                <button
                  type="button"
                  className="button button-outline"
                  disabled={images.length >= 4}
                  onClick={event => {
                    event.stopPropagation()

                    if (
                      images.length >= 4
                    ) {
                      setError(
                        'Maximum 4 images are allowed.'
                      )

                      return
                    }

                    fileInputRef.current?.click()
                  }}
                >
                  {images.length >= 4
                    ? 'Maximum 4 Images'
                    : 'Choose images'}
                </button>
              </div>

              {/* IMAGE PREVIEWS */}

              {images.length > 0 && (
                <div className="image-previews">
                  {images.map(image => (
                    <div
                      className="image-preview"
                      key={image.url}
                    >
                      <img
                        src={image.url}
                        alt="Selected equipment preview"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          removeImage(
                            image.url
                          )
                        }
                        aria-label="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* =================================================
              STEP 3
              ONLY FIRST IMAGE IS DISPLAYED
          ================================================= */}

          {step === 3 && (
            <>
              <FormIntro
                title="Review your submission"
                text="Your listing will stay private until our team approves it."
              />

              <div className="product-review-card">

                {/* -----------------------------------------
                    ONLY FIRST IMAGE
                ----------------------------------------- */}

                <div className="product-review-media">
                  {images.length > 0 ? (
                    <img
                      src={images[0].url}
                      alt={
                        form.name ||
                        'Equipment preview'
                      }
                    />
                  ) : (
                    <div className="product-review-placeholder">
                      <Upload size={24} />

                      <span>
                        No equipment image
                        selected
                      </span>
                    </div>
                  )}

                  <span className="listing-tag">
                    <ShieldCheck size={13} />
                    Ready for review
                  </span>
                </div>

                {/* -----------------------------------------
                    PRODUCT INFORMATION
                ----------------------------------------- */}

                <div className="product-review-content">

                  <div className="listing-meta">
                    <span>
                      {form.category}
                    </span>

                    <span>
                      {form.year}
                    </span>
                  </div>

                  <h3>{form.name}</h3>

                  <p className="product-review-price">
                    <span className="product-review-listing-type">
                      {form.listingType === 'rental' ? 'For rent' : 'For sale'}
                    </span>
                    {Number.isFinite(
                      formattedPrice
                    )
                      ? `₹${formattedPrice.toLocaleString(
                        'en-IN'
                      )}`
                      : 'Price on request'}
                  </p>

                  <div className="product-review-facts">

                    <span>
                      <b>Brand</b>
                      {form.brand}
                    </span>

                    <span>
                      <b>Model</b>
                      {form.model}
                    </span>

                    <span>
                      <b>Condition</b>
                      {form.condition}
                    </span>

                    <span>
                      <b>Location</b>
                      {form.location}
                    </span>

                  </div>

                  <p className="product-review-description">
                    {form.description}
                  </p>

                </div>
              </div>

              {/* -----------------------------------------
                  REVIEW NOTE
              ----------------------------------------- */}

              <div className="review-note">
                <ShieldCheck size={19} />

                <span>
                  Your mobile number
                  will be used for secure buyer
                  enquiries. We never publish
                  personal contact details.
                </span>
              </div>
            </>
          )}

          {/* =================================================
              ERROR
          ================================================= */}

          {error && (
            <p
              className="form-error"
              role="alert"
            >
              {error}
            </p>
          )}

          {/* =================================================
              FORM ACTIONS
          ================================================= */}

          <div className="form-actions">

            {step > 1 && (
              <button
                type="button"
                className="button button-ghost"
                onClick={() => {
                  setError('')
                  setStep(step - 1)
                }}
              >
                Back
              </button>
            )}

            <button
              className="button button-dark"
              type="submit"
              disabled={submitting}
            >
              {step === 3
                ? 'Submit for verification'
                : 'Continue'}

              <ArrowRight size={17} />
            </button>

          </div>
        </form>
      </div>

      {/* =====================================================
          SUBMISSION LOADER
      ===================================================== */}

      {submitting && (
        <div
          className="toast sell-mail-toast"
          role="status"
          aria-live="polite"
        >
          <LoaderCircle
            className="action-spinner"
            size={18}
          />

          Uploading images and sending
          request...
        </div>
      )}
    </main>
  )
}

// =========================================================
// FORM INTRO COMPONENT
// =========================================================

function FormIntro({
  title,
  text,
}) {
  return (
    <div className="form-intro">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  )
}

// =========================================================
// CLOUDINARY UPLOAD
// =========================================================

async function uploadToCloudinary(file) {
  const cloudName =
    import.meta.env
      .VITE_CLOUDINARY_CLOUD_NAME

  const uploadPreset =
    import.meta.env
      .VITE_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) {
    throw new Error(
      'Cloudinary is not configured. Set the client Cloudinary environment variables.'
    )
  }

  // -------------------------------------------------------
  // COMPRESS IMAGE BEFORE UPLOAD
  // -------------------------------------------------------

  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: 'image/webp',
  }

  let optimizedFile = file

  try {
    optimizedFile =
      await imageCompression(
        file,
        options
      )

    console.log(
      `Original: ${(
        file.size /
        1024 /
        1024
      ).toFixed(2)} MB`
    )

    console.log(
      `Optimized: ${(
        optimizedFile.size /
        1024 /
        1024
      ).toFixed(2)} MB`
    )
  } catch (error) {
    console.warn(
      'Image compression failed, uploading original file.',
      error
    )
  }

  // -------------------------------------------------------
  // CLOUDINARY FORM DATA
  // -------------------------------------------------------

  const formData = new FormData()

  formData.append(
    'file',
    optimizedFile
  )

  formData.append(
    'upload_preset',
    uploadPreset
  )

  formData.append(
    'folder',
    'equiptrade/listings'
  )

  // -------------------------------------------------------
  // UPLOAD
  // -------------------------------------------------------

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  )

  const data =
    await response.json()

  // -------------------------------------------------------
  // ERROR HANDLING
  // -------------------------------------------------------

  if (
    !response.ok ||
    !data.secure_url
  ) {
    throw new Error(
      data.error?.message ||
      'Unable to upload an image to Cloudinary.'
    )
  }

  return data.secure_url
}