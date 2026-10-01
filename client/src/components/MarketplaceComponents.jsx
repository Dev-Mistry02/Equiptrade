import { ArrowRight, BadgeCheck, Building2, Heart } from 'lucide-react'

export function EquipmentCard({ item, onClick }) {
  const image = item.images?.[0]
  return (
    <article
      className="equipment-card"
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <button
        className="heart"
        aria-label="Save listing"
        onClick={e => {
          e.stopPropagation()
        }}
      >
        <Heart size={17} />
      </button>

      <div className="equipment-image">
        {image ? (
          <img src={image} alt={item.name} />
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
