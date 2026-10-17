import { ArrowRight, BadgeCheck, Building2, Heart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isListingSaved, savedListingsChangedEvent } from '../savedListings'

function getResponsiveImageSource(image, width) {
  try {
    const url = new URL(image)
    if (url.hostname !== 'res.cloudinary.com') return ''

    const uploadPath = '/image/upload/'
    const uploadIndex = url.pathname.indexOf(uploadPath)
    if (uploadIndex < 0) return ''

    const insertAt = uploadIndex + uploadPath.length
    url.pathname = `${url.pathname.slice(0, insertAt)}f_auto,q_auto:eco,w_${width},c_limit/${url.pathname.slice(insertAt)}`
    return url.toString()
  } catch {
    return ''
  }
}

export function EquipmentCard({ item, onClick, onSave, imageSizes }) {
  const image = item.images?.[0]
  const listingId = item._id || item.id
  const [saved, setSaved] = useState(() => isListingSaved(listingId))

  useEffect(() => {
    const syncSavedState = () => setSaved(isListingSaved(listingId))
    window.addEventListener(savedListingsChangedEvent, syncSavedState)
    return () => window.removeEventListener(savedListingsChangedEvent, syncSavedState)
  }, [listingId])

  const responsiveImageSet = image
    ? [320, 480, 640, 960]
      .map(width => {
        const src = getResponsiveImageSource(image, width)
        return src ? `${src} ${width}w` : ''
      })
      .filter(Boolean)
      .join(', ')
    : ''

  return (
    <article
      className="equipment-card"
      onClick={onClick}
      onKeyDown={event => {
        if (
          event.target === event.currentTarget &&
          (event.key === 'Enter' || event.key === ' ')
        ) {
          event.preventDefault()
          onClick?.(item)
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={`View details for ${item.name}`}
      style={{ cursor: 'pointer' }}
    >
      <button
        className="heart"
        aria-label={saved ? 'Remove saved listing' : 'Save listing'}
        aria-pressed={saved}
        onClick={e => {
          e.stopPropagation()
          onSave?.(item)
        }}
      >
        <Heart size={17} fill={saved ? 'currentColor' : 'none'} />
      </button>

      <div className="equipment-image">
        {image ? (
          <img
            src={getResponsiveImageSource(image, 640) || image}
            srcSet={responsiveImageSet || undefined}
            sizes={imageSizes || '(max-width: 700px) 90vw, (max-width: 1000px) 45vw, 33vw'}
            alt={item.name}
            width="800"
            height="550"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="equipment-image-empty">
            No image provided
          </span>
        )}
        {['approved', 'published'].includes(item.status) &&
          item.isActive !== false &&
          item.isQualityHold !== true && (
            <span className="listing-tag">
              <BadgeCheck size={13} /> Verified
            </span>
          )}
        {(item.inventoryCondition || item.condition) && (
          <div className="equipment-condition-badges">
            {item.condition && (
              <span className="equipment-condition-badge">{item.condition}</span>
            )}
            {item.inventoryCondition && (
              <span className="inventory-condition-badge">{item.inventoryCondition}</span>
            )}
          </div>
        )}
      </div>

      <div className="equipment-body">
        <div className="listing-meta">
          <span>{item.category}</span>
          {item.year && <span>{item.year}</span>}
        </div>

        <h3>{item.name}</h3>
        <span className="equipment-listing-type">
          {item.listingType === 'rental' ? 'For rent' : 'For sale'}
        </span>

        {(item.brand || item.model) && (
          <p className="equipment-manufacturer-model">
            {[item.brand, item.model].filter(Boolean).join(' · ')}
          </p>
        )}
        {item.seller?.name && (
          <p className="equipment-seller-name">
            Seller: {item.seller.name}
            {item.seller.verified === true && (
              <span className="equipment-seller-verified">
                <BadgeCheck size={12} /> Verified seller
              </span>
            )}
          </p>
        )}
        {item.oemPartNumber && (
          <p className="equipment-oem-part-number">OEM Part No.: {item.oemPartNumber}</p>
        )}

        <div className="equipment-footer">
          <strong>
            {Number.isFinite(Number(item.price)) && item.price !== null && item.price !== ''
              ? `₹${Number(item.price).toLocaleString('en-IN')}`
              : 'Contact for Price'}
          </strong>
          {item.location && (
            <span>
              <Building2 size={14} /> {item.location.split(',')[0]}
            </span>
          )}
        </div>

        <button
          type="button"
          className="equipment-see-details-button"
          aria-label={`View details for ${item.name}`}
          onClick={event => {
            event.stopPropagation()
            onClick?.(item)
          }}
        >
          See Details
        </button>
      </div>
    </article>
  )
}


export function SectionHeading({ eyebrow, title, link, onClick }) {
  return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{link && <button className="text-link heading-link" onClick={onClick}>{link} <ArrowRight size={16} /></button>}</div>
}

export function Process({ icon, number, title, text }) {
  return <div className="process-step"><span className="process-number">{number}</span><div className="process-icon">{icon}</div><h3>{title}</h3><p>{text}</p></div>
}
