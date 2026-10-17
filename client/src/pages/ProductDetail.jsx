import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  HelpCircle,
  LoaderCircle,
  MapPin,
  MessageSquare,
  PhoneCall,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Truck,
  Wrench,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { EquipmentCard } from '../components/MarketplaceComponents'
import {
  getCachedListings,
  getCachedProduct,
  setCachedListings,
  setCachedProduct,
} from '../marketplaceCache'
import { toProductSlug } from '../productSlug'
import { isPublicQualityListing } from '../listingQuality'
import { isListingSaved, toggleSavedListing } from '../savedListings'
import '../product-detail.css'

export { toProductSlug }

function matchesProductSlug(item, targetSlug) {
  if (!item || !targetSlug) return false
  const decoded = decodeURIComponent(targetSlug).toLowerCase().trim()
  const itemSlug = toProductSlug(item.name)
  const itemRaw = (item.name || '').toLowerCase().trim()
  const slugifiedDecoded = toProductSlug(decoded)

  return (
    String(item._id) === targetSlug ||
    String(item.id) === targetSlug ||
    itemSlug === targetSlug.toLowerCase() ||
    itemSlug === slugifiedDecoded ||
    itemRaw === decoded ||
    itemRaw.replace(/\s+/g, '-') === decoded.replace(/\s+/g, '-')
  )
}

export default function ProductDetail({
  slug,
  product: initialProduct,
  navigate,
  notify,
  requireVerification,
  user,
}) {
  const [item, setItem] = useState(() => {
    if (initialProduct && isPublicQualityListing(initialProduct) && matchesProductSlug(initialProduct, slug)) {
      return initialProduct
    }
    const cachedProduct = getCachedProduct(slug)
    return isPublicQualityListing(cachedProduct) ? cachedProduct : null
  })

  const [loading, setLoading] = useState(!item)
  const [error, setError] = useState('')
  const [activeImage, setActiveImage] = useState(0)
  const [allListings, setAllListings] = useState(
    () => getCachedListings() || []
  )
  const [enquiryModal, setEnquiryModal] = useState(false)
  const [enquirySending, setEnquirySending] = useState(false)
  const [enquiryError, setEnquiryError] = useState('')
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false)
  const [ratingModal, setRatingModal] = useState(false)
  const [ratingPending, setRatingPending] = useState(false)
  const [serviceRating, setServiceRating] = useState(0)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackSending, setFeedbackSending] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')
  const productRequestVersion = useRef(0)

  const [isSaved, setIsSaved] = useState(() =>
    isListingSaved(item?._id || item?.id)
  )

  const [enquiryForm, setEnquiryForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    mobileNumber: user?.mobileNumber || '',
    message: '',
  })

  // Synchronize user profile into enquiry form when available
  useEffect(() => {
    if (user) {
      setEnquiryForm(current => ({
        ...current,
        name: current.name || user.name || '',
        email: current.email || user.email || '',
        mobileNumber: current.mobileNumber || user.mobileNumber || '',
      }))
    }
  }, [user])

  useEffect(() => {
    const syncSavedState = () => {
      setIsSaved(isListingSaved(item?._id || item?.id))
    }
    syncSavedState()
    window.addEventListener('equiptrade:saved-listings-changed', syncSavedState)
    return () => {
      window.removeEventListener('equiptrade:saved-listings-changed', syncSavedState)
    }
  }, [item])

  useEffect(() => {
    if (!ratingPending) return undefined

    const timeoutId = window.setTimeout(() => {
      setRatingPending(false)
      setRatingModal(true)
    }, 5000)

    return () => window.clearTimeout(timeoutId)
  }, [ratingPending])

  /*
   * Fetch item if not already loaded in memory or on direct URL visit
   */
  const loadProduct = useCallback(async () => {
    if (!slug) return

    const requestId = ++productRequestVersion.current

    try {
      const cachedCandidate = getCachedProduct(slug)
      const cachedProduct = isPublicQualityListing(cachedCandidate) ? cachedCandidate : null
      if (!cachedProduct) setLoading(true)
      setError('')

      let found = cachedProduct || null
      let listingsLoaded = false

      // First try specific endpoint
      try {
        const direct = await api.getEquipmentByIdOrSlug(slug)
        if (isPublicQualityListing(direct)) {
          found = direct
        }
      } catch {
        // Fall back to listing search
      }

      if (requestId !== productRequestVersion.current) return

      if (!found) {
        const data = await api.getEquipment()
        if (requestId !== productRequestVersion.current) return
        if (!Array.isArray(data)) {
          throw new Error('The marketplace returned an unexpected response.')
        }

        setAllListings(data)
        setCachedListings('all', data)
        listingsLoaded = true
        found = data.find(listing =>
          isPublicQualityListing(listing) && matchesProductSlug(listing, slug)
        )
      }

      if (!found) {
        setError('Equipment listing not found or has been withdrawn.')
        return
      }

      setCachedProduct(slug, found)
      setItem(found)
      setActiveImage(0)

      if (listingsLoaded) return

      api.getEquipment()
        .then(data => {
          if (requestId !== productRequestVersion.current) return
          if (!Array.isArray(data)) {
            throw new Error('The marketplace returned an unexpected response.')
          }
          setCachedListings('all', data)
          setAllListings(data)
        })
        .catch(error => {
          if (requestId === productRequestVersion.current) {
            console.warn('Unable to load related equipment:', error)
          }
        })
    } catch (err) {
      if (requestId !== productRequestVersion.current) return
      console.error('Failed to load equipment detail:', err)
      setError(err.message || 'Unable to load equipment details.')
    } finally {
      if (requestId === productRequestVersion.current) {
        setLoading(false)
      }
    }
  }, [slug])

  useEffect(() => {
    const selectedProduct =
      initialProduct && isPublicQualityListing(initialProduct) && matchesProductSlug(initialProduct, slug)
        ? initialProduct
        : item

    if (selectedProduct && selectedProduct !== item) {
      setItem(selectedProduct)
      setCachedProduct(slug, selectedProduct)
      setActiveImage(0)
      setError('')
      setLoading(false)
    }

    if (!selectedProduct || !isPublicQualityListing(selectedProduct) || !matchesProductSlug(selectedProduct, slug)) {
      loadProduct()
      return () => {
        productRequestVersion.current += 1
      }
    } else {
      // Background load other listings for related items
      let active = true
      api.getEquipment()
        .then(data => {
          if (!active) return
          if (!Array.isArray(data)) {
            throw new Error('The marketplace returned an unexpected response.')
          }
          setCachedListings('all', data)
          setAllListings(data)
        })
        .catch(error => {
          if (active) {
            console.warn('Unable to load related equipment:', error)
          }
        })

      return () => {
        active = false
      }
    }
  }, [slug, loadProduct, initialProduct])

  // Images list
  const images = useMemo(() => {
    if (!item) return []
    if (Array.isArray(item.images) && item.images.length) {
      return item.images
    }
    if (item.image) return [item.image]
    return []
  }, [item])

  // Related equipment
  const relatedListings = useMemo(() => {
    if (!item || !allListings.length) return []
    return allListings
      .filter(
        listing =>
          isPublicQualityListing(listing) &&
          (listing._id || listing.id) !== (item._id || item.id) &&
          (listing.category === item.category || !item.category)
      )
      .slice(0, 3)
  }, [item, allListings])

  const toggleSave = listing => {
    try {
      const saved = toggleSavedListing(listing?._id || listing?.id)
      if ((listing?._id || listing?.id) === (item?._id || item?.id)) {
        setIsSaved(saved)
      }
      notify?.(saved ? 'Added to your saved listings.' : 'Removed from saved listings.')
    } catch (error) {
      console.error('Unable to update saved listing:', error)
      notify?.(error.message || 'Unable to update saved listing.')
    }
  }

  const handleShare = async () => {
    const shareUrl = window.location.href

    try {
      await navigator.clipboard.writeText(shareUrl)

      notify?.('Product link copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy link:', error)

      // Fallback for browsers where Clipboard API is unavailable
      try {
        const textArea = document.createElement('textarea')

        textArea.value = shareUrl
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'

        document.body.appendChild(textArea)

        textArea.focus()
        textArea.select()

        document.execCommand('copy')

        document.body.removeChild(textArea)

        notify?.('Product link copied to clipboard!')
      } catch {
        notify?.('Unable to copy the link. Please copy it manually.')
      }
    }
  }

  const shareListing = () => {
    if (user) {
      handleShare()
    } else {
      requireVerification?.(handleShare)
    }
  }

  const saveListing = listing => {
    const selectedListing = listing || item
    if (user) {
      toggleSave(selectedListing)
    } else {
      requireVerification?.(() => toggleSave(selectedListing))
    }
  }

  const openEnquiry = () => {
    setEnquiryError('')
    setEnquiryModal(true)
  }

  const sendEnquiry = async () => {
    setEnquirySending(true)
    setEnquiryError('')

    try {
      const response = await api.sendEnquiry(item._id || item.id, {
        name: enquiryForm.name,
        mobileNumber: enquiryForm.mobileNumber,
        message: enquiryForm.message,
      })
      setConfirmationEmailSent(response.confirmationEmailSent)
      setEnquiryModal(false)
      setServiceRating(0)
      setFeedbackMessage('')
      setFeedbackError('')
      setRatingPending(true)
      notify?.(
        response.confirmationEmailSent
          ? 'Your enquiry was sent to the seller.'
          : 'Your enquiry was sent, but the confirmation email could not be sent.'
      )
    } catch (error) {
      setEnquiryError(
        error.message || 'Unable to send your enquiry. Please try again.'
      )
    } finally {
      setEnquirySending(false)
    }
  }

  const submitEnquiry = event => {
    event.preventDefault()

    if (!user) {
      if (requireVerification) {
        requireVerification(sendEnquiry)
      } else {
        setEnquiryError('Verify your account before sending an enquiry.')
      }
      return
    }

    sendEnquiry()
  }

  const submitServiceFeedback = async event => {
    event.preventDefault()
    setFeedbackSending(true)
    setFeedbackError('')

    try {
      await api.submitServiceFeedback({
        equipmentId: item._id || item.id,
        rating: serviceRating,
        message: feedbackMessage,
      })
      setRatingModal(false)
      notify?.('Thank you for rating our services.')
    } catch (error) {
      setFeedbackError(
        error.message || 'Unable to save your feedback. Please try again.'
      )
    } finally {
      setFeedbackSending(false)
    }
  }

  /* ---------------- Loading State ---------------- */
  if (loading) {
    return (
      <main className="container page product-detail-page">
        <div className="pd-nav-header">
          <button
            type="button"
            className="pd-back-btn"
            onClick={() => navigate('browse')}
          >
            <ArrowLeft size={16} />
            Back to all equipment
          </button>
        </div>

        <div style={{ padding: '80px 20px', textAlign: 'center' }}>
          <LoaderCircle
            className="action-spinner"
            size={36}
            style={{ margin: '0 auto 16px', color: 'var(--blue)' }}
          />
          <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 24 }}>
            Loading equipment details...
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            Retrieving verified specifications and photos from EquipTrade network.
          </p>
        </div>
      </main>
    )
  }

  /* ---------------- Error / Not Found State ---------------- */
  if (error || !item) {
    return (
      <main className="container page product-detail-page">
        <div className="pd-nav-header">
          <button
            type="button"
            className="pd-back-btn"
            onClick={() => navigate('browse')}
          >
            <ArrowLeft size={16} />
            Back to marketplace
          </button>
        </div>

        <div className="pd-not-found">
          <div className="process-icon" style={{ margin: '0 auto 20px' }}>
            <HelpCircle size={28} />
          </div>
          <span className="eyebrow" style={{ justifyContent: 'center' }}>
            Listing Notice
          </span>
          <h2>Equipment Not Found</h2>
          <p>
            {error ||
              'This equipment may have been sold or removed from the marketplace.'}
          </p>
          <button
            type="button"
            className="button button-dark"
            style={{ margin: '0 auto' }}
            onClick={() => navigate('browse')}
          >
            Browse verified equipment
            <ArrowRight size={16} />
          </button>
        </div>
      </main>
    )
  }

  const formattedPrice = item.price
    ? `₹${Number(item.price).toLocaleString('en-IN')}`
    : 'Price on request'

  const listingRefId = `EQP-${(item._id || item.id || '2026')
    .toString()
    .slice(-6)
    .toUpperCase()}`

  return (
    <main className="container page product-detail-page">
      {/* ---------------- NAVIGATION / BREADCRUMBS ---------------- */}
      <div className="pd-nav-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            type="button"
            className="pd-back-btn"
            onClick={() => navigate('browse')}
            aria-label="Back to browse"
          >
            <ArrowLeft size={16} />
            Back to browse
          </button>

          <nav className="pd-breadcrumbs" aria-label="Breadcrumb">
            <button type="button" onClick={() => navigate('home')}>
              Home
            </button>
            <ChevronRight size={13} />
            <button type="button" onClick={() => navigate('browse')}>
              Buy equipment
            </button>
            {item.category && (
              <>
                <ChevronRight size={13} />
                <button
                  type="button"
                  onClick={() => {
                    navigate('browse')
                  }}
                >
                  {item.category}
                </button>
              </>
            )}
            <ChevronRight size={13} />
            <span className="pd-bc-current">{item.name}</span>
          </nav>
        </div>

        <div className="pd-top-actions">
          <button
            type="button"
            className="pd-action-btn"
            onClick={shareListing}
            title="Share this listing"
          >
            <Share2 size={15} />
            Share
          </button>

          <button
            type="button"
            className={`pd-action-btn ${isSaved ? 'saved' : ''}`}
            onClick={saveListing}
            title="Save to watchlist"
          >
            <Heart size={15} fill={isSaved ? '#d13438' : 'none'} />
            {isSaved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* ---------------- MAIN PRODUCT GRID ---------------- */}
      <div className="pd-main-grid">
        {/* LEFT: GALLERY & ASSURANCE */}
        <div className="pd-gallery-section">
          <div className="pd-gallery-card">
            <div className="pd-main-image-wrap">
              {images.length > 0 ? (
                <img
                  src={images[activeImage] || images[0]}
                  alt={item.name}
                  className="pd-main-image"
                />
              ) : (
                <div className="pd-image-empty">
                  <Wrench size={36} />
                  <span>No photo provided for this listing</span>
                </div>
              )}

              {['approved', 'published'].includes(item.status) &&
                item.isActive !== false &&
                item.isQualityHold !== true && (
                <span className="pd-badge-verified">
                  <BadgeCheck size={14} />
                  Verified Equipment
                </span>
              )}

              {images.length > 1 && (
                <span className="pd-image-counter">
                  Photo {activeImage + 1} of {images.length}
                </span>
              )}
            </div>

            {images.length > 1 && (
              <div className="pd-thumbnails">
                {images.map((imgUrl, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`pd-thumb-btn ${activeImage === index ? 'active' : ''
                      }`}
                    onClick={() => setActiveImage(index)}
                    aria-label={`View photo ${index + 1}`}
                  >
                    <img src={imgUrl} alt={`${item.name} thumbnail ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Trust strip */}
          <div className="pd-trust-highlights">
            <div className="pd-trust-item">
              <div className="pd-trust-icon">
                <ShieldCheck size={18} />
              </div>
              <div className="pd-trust-text">
                <strong>Physical Review</strong>
                <small>Checked by EquipTrade inspection team</small>
              </div>
            </div>

            <div className="pd-trust-item">
              <div className="pd-trust-icon">
                <BadgeCheck size={18} />
              </div>
              <div className="pd-trust-text">
                <strong>Direct Seller</strong>
                <small>Zero middlemen commission or undisclosed markup</small>
              </div>
            </div>

            <div className="pd-trust-item">
              <div className="pd-trust-icon">
                <Truck size={18} />
              </div>
              <div className="pd-trust-text">
                <strong>Transport Support</strong>
                <small>Pan-India machinery logistics assistance</small>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: OVERVIEW & ENQUIRY ACTIONS */}
        <div className="pd-info-card">
          <div className="pd-header-meta">
            <span className="pd-category-tag">
              <Tag size={12} />
              {item.category || 'Machinery'}
            </span>
            {/* <span className="pd-listing-id">{listingRefId}</span> */}
          </div>

          <h1 className="pd-title">{item.name}</h1>
          {item.inventoryCondition && (
            <span className="inventory-condition-badge pd-inventory-condition-badge">
              {item.inventoryCondition}
            </span>
          )}

          <p className="pd-subtitle">
            {item.brand || 'Brand not specified'} ·{' '}
            {item.model || 'Model not specified'} ·{' '}
            {item.year ? `Year ${item.year}` : 'Manufacturing year unlisted'}
          </p>

          {/* Pricing Box */}
          <div className="pd-price-box">
            <div>
              <span className="pd-price-label">
                {item.listingType === 'rental' ? 'Rental price' : 'Sale price'}
              </span>
              <div className="pd-price-amount">{formattedPrice}</div>
            </div>

            <div className="pd-price-terms">
              <span className="pd-price-tag">
                {item.condition || 'Verified Condition'}
              </span>
              <span className="pd-price-note">Ex-yard · Taxes extra</span>
            </div>
          </div>

          {/* Quick specs grid */}
          <div className="pd-quick-specs">
            <div className="pd-spec-tile">
              <span className="pd-spec-label">Brand</span>
              <strong className="pd-spec-value">
                {item.brand || 'Not provided'}
              </strong>
            </div>

            <div className="pd-spec-tile">
              <span className="pd-spec-label">Model</span>
              <strong className="pd-spec-value">
                {item.model || 'Not provided'}
              </strong>
            </div>

            <div className="pd-spec-tile">
              <span className="pd-spec-label">Manufacturing Year</span>
              <strong className="pd-spec-value">
                {item.year || 'Not provided'}
              </strong>
            </div>

            <div className="pd-spec-tile">
              <span className="pd-spec-label">Condition</span>
              <strong className="pd-spec-value">
                {item.condition || 'Good'}
              </strong>
            </div>
          </div>

          {/* Location banner */}
          <div className="pd-location-banner">
            <MapPin size={16} />
            <div>
              Machine Location: <strong>{item.location || 'India'}</strong>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="pd-cta-group">
            <button
              type="button"
              className="pd-enquire-btn"
              onClick={openEnquiry}
            >
              <MessageSquare size={18} />
              I’m Interested · Enquire Now
              <ArrowRight size={17} />
            </button>

            <button
              type="button"
              className="pd-secondary-btn"
              onClick={() =>
                user
                  ? notify?.(
                      'Our equipment specialist will contact you to arrange an inspection.'
                    )
                  : requireVerification?.(() =>
                      notify?.(
                        'Our equipment specialist will contact you to arrange an inspection.'
                      )
                    )
              }
            >
              <PhoneCall size={16} />
              Request Video Inspection / Call Specialist
            </button>
          </div>

          {/* Reviewed Note */}
          <div className="detail-note">
            <ShieldCheck size={18} />
            <span>
              <strong>Reviewed by EquipTrade team.</strong> Contact the seller to confirm
              equipment details and arrange an inspection before purchase.
            </span>
          </div>
        </div>
      </div>

      {/* ---------------- DETAILED SPECIFICATIONS & DESCRIPTION ---------------- */}
      <section className="pd-details-card">
        <h2 className="pd-section-title">
          <Wrench size={20} />
          Equipment Overview & Specifications
        </h2>

        {item.description ? (
          <div className="pd-description-content">
            <p>{item.description}</p>
          </div>
        ) : (
          <div className="pd-description-content">
            <p>
              This verified {item.brand || ''} {item.name} is currently available
              for purchase in {item.location || 'India'}. Tested and inspected in{' '}
              {item.condition?.toLowerCase() || 'working'} condition. Suitable for
              industrial operations and immediate deployment.
            </p>
          </div>
        )}

        <h3 className="pd-section-title" style={{ fontSize: 18, marginTop: 32 }}>
          <CheckCircle2 size={18} />
          Full Specification Sheet
        </h3>

        <div className="pd-specs-table-grid">
          <div className="pd-spec-row">
            <span>Listing Reference</span>
            <strong>{listingRefId}</strong>
          </div>

          <div className="pd-spec-row">
            <span>Category</span>
            <strong>{item.category || 'General Machinery'}</strong>
          </div>

          <div className="pd-spec-row">
            <span>Manufacturer / Brand</span>
            <strong>{item.brand || 'Not specified'}</strong>
          </div>

          <div className="pd-spec-row">
            <span>Machine Model</span>
            <strong>{item.model || 'Not specified'}</strong>
          </div>

          {item.oemPartNumber && (
            <div className="pd-spec-row">
              <span>OEM Part Number</span>
              <strong>{item.oemPartNumber}</strong>
            </div>
          )}

          <div className="pd-spec-row">
            <span>Manufacturing Year</span>
            <strong>{item.year || 'Not specified'}</strong>
          </div>

          <div className="pd-spec-row">
            <span>Equipment Condition</span>
            <strong>{item.condition || 'Inspected'}</strong>
          </div>

          {item.inventoryCondition && (
            <div className="pd-spec-row">
              <span>Inventory Condition</span>
              <strong>{item.inventoryCondition}</strong>
            </div>
          )}

          <div className="pd-spec-row">
            <span>Operational Hours / Usage</span>
            <strong>{item.usage || 'Verified on request'}</strong>
          </div>

          <div className="pd-spec-row">
            <span>Physical Location</span>
            <strong>{item.location || 'Pan-India'}</strong>
          </div>

          <div className="pd-spec-row">
            <span>Verification Status</span>
            <strong style={{ color: '#277258' }}>
              {item.verificationStatus || 'Approved by EquipTrade'}
            </strong>
          </div>

          <div className="pd-spec-row">
            <span>Direct Seller</span>
            <strong>
              {item.seller?.name || 'Seller details available on enquiry'}
              {item.seller?.verified === true && (
                <span className="pd-seller-verified">
                  <BadgeCheck size={13} /> Verified seller
                </span>
              )}
            </strong>
          </div>
        </div>
      </section>

      {/* ---------------- BUYER PROTECTION & ESCROW BANNER ---------------- */}
      {/* <section className="pd-protection-strip">
        <div className="pd-protection-header">
          <span>The EquipTrade Standard</span>
          <h3>Transact with Absolute Confidence</h3>
        </div>

        <div className="pd-protection-grid">
          <div className="pd-protection-card">
            <h4>01. Transparent Due Diligence</h4>
            <p>
              We confirm ownership documents, serial numbers, and equipment
              condition prior to publishing.
            </p>
          </div>

          <div className="pd-protection-card">
            <h4>02. Physical Inspection Support</h4>
            <p>
              Schedule an in-person or high-definition live video inspection
              guided by an EquipTrade machinery engineer.
            </p>
          </div>

          <div className="pd-protection-card">
            <h4>03. Secure Escrow & Handover</h4>
            <p>
              Buyer funds are protected safely in escrow until the machine is
              physically verified and handed over at dispatch.
            </p>
          </div>
        </div>
      </section> */}

      {/* ---------------- RELATED EQUIPMENT ---------------- */}
      {relatedListings.length > 0 && (
        <section className="pd-related-section">
          <div className="pd-related-header">
            <div>
              <span className="eyebrow">Explore alternatives</span>
              <h3>Similar Equipment in {item.category || 'Marketplace'}</h3>
            </div>
            <button
              type="button"
              className="text-link heading-link"
              onClick={() => navigate('browse')}
            >
              View all listings <ArrowRight size={15} />
            </button>
          </div>

          <div className="listing-grid pd-related-grid">
            {relatedListings.map(rel => (
              <EquipmentCard
                key={rel._id || rel.id}
                item={rel}
                onSave={saveListing}
                onClick={() =>
                  navigate('product-detail', {
                    product: rel,
                    slug: String(rel._id || rel.id || toProductSlug(rel.name)),
                  })
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* ---------------- STICKY MOBILE ENQUIRY BAR ---------------- */}
      <div className="pd-mobile-sticky-bar">
        <div>
          <div className="pd-mobile-price">{formattedPrice}</div>
          <small>{item.name}</small>
        </div>

        <button
          type="button"
          className="pd-mobile-enquire-btn"
          onClick={openEnquiry}
        >
          <MessageSquare size={16} />
          Enquire Now
        </button>
      </div>

      {/* ---------------- ENQUIRY MODAL ---------------- */}
      {enquiryModal && (
        <div
          className="pd-modal-backdrop"
          onClick={() => setEnquiryModal(false)}
        >
          <div
            className="pd-modal-box"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Enquire about equipment"
          >
            <button
              type="button"
              className="pd-modal-close"
              onClick={() => setEnquiryModal(false)}
              aria-label="Close enquiry modal"
            >
              <X size={20} />
            </button>

            <div className="pd-modal-header">
              <span className="eyebrow">
                <Sparkles size={13} /> Direct Seller Enquiry
              </span>
              <h3>Interested in {item.name}?</h3>
              <p>
                Submit your enquiry below. Our team connects you directly with the
                seller and coordinates inspection.
              </p>
            </div>

            <div className="pd-modal-product-summary">
              {images[0] ? (
                <img
                  src={images[0]}
                  alt={item.name}
                  className="pd-modal-thumb"
                />
              ) : (
                <div className="pd-modal-thumb pd-image-empty">
                  <Wrench size={16} />
                </div>
              )}
              <div>
                <strong style={{ fontSize: 13, display: 'block' }}>
                  {item.name}
                </strong>
                <span
                  style={{
                    color: 'var(--blue)',
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {formattedPrice}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 11,
                    color: 'var(--muted)',
                  }}
                >
                  {item.location || 'India'}
                </span>
              </div>
            </div>

            <form className="pd-modal-form" onSubmit={submitEnquiry}>
              <div className="pd-enquiry-contact-fields">
                <label>
                  Your Name
                  <input
                    type="text"
                    required
                    value={enquiryForm.name}
                    onChange={e =>
                      setEnquiryForm({ ...enquiryForm, name: e.target.value })
                    }
                    placeholder="Enter your name"
                  />
                </label>

                <label>
                  Mobile Number
                  <input
                    type="tel"
                    required
                    value={enquiryForm.mobileNumber}
                    onChange={e =>
                      setEnquiryForm({
                        ...enquiryForm,
                        mobileNumber: e.target.value,
                      })
                    }
                    placeholder="e.g. 9274705046"
                  />
                </label>
              </div>

              {user ? (
                <label>
                  Email Address
                  <input
                    type="email"
                    required
                    value={user.email || enquiryForm.email}
                    readOnly
                    placeholder="Enter email address"
                  />
                </label>
              ) : (
                <p className="pd-enquiry-signin-note">
                  Verify your account before sending. Your message will stay
                  ready while you verify your email.
                </p>
              )}

              <label>
                Message for Seller
                <textarea
                  required
                  rows={3}
                  value={enquiryForm.message}
                  onChange={e =>
                    setEnquiryForm({ ...enquiryForm, message: e.target.value })
                  }
                  placeholder="I am interested in this machine. Please provide inspection availability and transport estimate..."
                />
              </label>

              <button
                type="submit"
                className="pd-modal-submit-btn"
                disabled={enquirySending}
              >
                {enquirySending ? (
                  <>
                    <LoaderCircle className="action-spinner" size={17} />
                    Sending enquiry...
                  </>
                ) : (
                  <>
                    {user ? 'Send Enquiry to Seller' : 'Sign in & Send Enquiry'}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
              {enquiryError && (
                <p className="verification-error" role="alert">
                  {enquiryError}
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {ratingModal && (
        <div
          className="pd-modal-backdrop pd-rating-backdrop"
          onClick={() => setRatingModal(false)}
        >
          <div
            className="pd-modal-box pd-rating-box"
            onClick={event => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pd-rating-title"
          >
            <button
              type="button"
              className="pd-modal-close"
              onClick={() => setRatingModal(false)}
              aria-label="Close service rating"
            >
              <X size={20} />
            </button>

            <div className="pd-rating-hero">
              <span className="pd-rating-success-icon"><CheckCircle2 size={23} /></span>
              <span className="pd-rating-kicker"><Sparkles size={14} /> ENQUIRY SENT</span>
              <h3 id="pd-rating-title">How did we do?</h3>
              <p>
                {confirmationEmailSent
                  ? 'Your enquiry reached the seller. Take a moment to rate your EquipTrade experience.'
                  : 'Your enquiry reached the seller. We could not send a confirmation email, but you can still rate your experience.'}
              </p>
            </div>

            <form className="pd-modal-form" onSubmit={submitServiceFeedback}>
              <div className="pd-rating-picker">
                <span className="pd-rating-prompt">Your overall experience</span>
                <div className="pd-rating-stars" role="group" aria-label="Service rating">
                  {[1, 2, 3, 4, 5].map(value => (
                    <button
                      key={value}
                      type="button"
                      className={value <= serviceRating ? 'selected' : ''}
                      onClick={() => setServiceRating(value)}
                      aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
                      aria-pressed={serviceRating === value}
                    >
                      <Star size={30} fill={value <= serviceRating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
                <span className="pd-rating-hint">
                  {serviceRating
                    ? ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'][serviceRating - 1]
                    : 'Tap a star to rate'}
                </span>
              </div>

              <label className="pd-feedback-readonly">
                Your Name
                <input type="text" value={user?.name || ''} readOnly />
              </label>

              <label className="pd-feedback-readonly">
                Email Address
                <input type="email" value={user?.email || ''} readOnly />
              </label>

              <label>
                Your Message <span className="pd-feedback-optional">Your feedback helps us improve</span>
                <textarea
                  required
                  rows={4}
                  maxLength={2000}
                  value={feedbackMessage}
                  onChange={event => setFeedbackMessage(event.target.value)}
                  placeholder="Tell us how we can improve your experience..."
                />
              </label>

              <button
                type="submit"
                className="pd-modal-submit-btn pd-rating-submit"
                disabled={feedbackSending || serviceRating === 0}
              >
                {feedbackSending ? (
                  <>
                    <LoaderCircle className="action-spinner" size={17} />
                    Saving feedback...
                  </>
                ) : (
                  <>
                    Share my feedback
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
              {feedbackError && (
                <p className="verification-error" role="alert">
                  {feedbackError}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
