import { ArrowRight, BadgeCheck, Building2, Heart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isListingSaved, savedListingsChangedEvent } from '../savedListings'

export function EquipmentCard({ item, onClick, onSave }) {
  const image = item.images?.[0]
  const listingId = item._id || item.id
  const [saved, setSaved] = useState(() => isListingSaved(listingId))

  useEffect(() => {
    const syncSavedState = () => setSaved(isListingSaved(listingId))
    syncSavedState()
    window.addEventListener(savedListingsChangedEvent, syncSavedState)
    return () => window.removeEventListener(savedListingsChangedEvent, syncSavedState)
  }, [listingId])

  return (
    <article
      className="equipment-card"
      onClick={onClick}
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
            src={image}
            alt={item.name}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="equipment-image-empty">
            No image provided
          </span>
        )}
        <span className="listing-tag">
          <BadgeCheck size={13} /> Verified
        </span>
      </div>

      <div className="equipment-body">
        <div className="listing-meta">
          <span>{item.category}</span>
          <span>{item.year || 'Year not provided'}</span>
        </div>

        <h3>{item.name}</h3>
        <span className="equipment-listing-type">
          {item.listingType === 'rental' ? 'For rent' : 'For sale'}
        </span>

        <p>
          {item.brand || 'Brand not provided'} · {item.model || 'Model not provided'} · {item.condition || 'Condition not provided'}
        </p>

        <div className="equipment-footer">
          <strong>
            {item.price
              ? `₹${Number(item.price).toLocaleString('en-IN')}`
              : 'Price on request'}
          </strong>
          <span>
            <Building2 size={14} /> {(item.location || 'Location not provided').split(',')[0]}
          </span>
        </div>
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
