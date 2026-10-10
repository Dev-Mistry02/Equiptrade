import { ArrowRight, BadgeCheck, Building2, ClipboardCheck, Search, ShieldCheck, Sparkles, Truck, Upload, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { EquipmentCard, Process, SectionHeading } from '../components/MarketplaceComponents'

export default function Home({ navigate, setSelected, search, setSearch }) {
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const loadEquipment = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      setEquipment(await api.getEquipment())
    } catch (requestError) {
      setError(requestError.message || 'Unable to load equipment.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEquipment()
  }, [loadEquipment])
  const categoryNames = [...new Set(equipment.map(item => item.category).filter(Boolean))]
  return (
    <main className="home-page">
      <section className="home-hero">
        <span className="hero-gear" aria-hidden="true">⚙</span>
        <div className="hero container">
          <div className="hero-copy">
            <div className="eyebrow"><span className="pulse-dot" /> India's verified equipment network</div>
            <h1>Monetize Your<br /><em>Idle Assets &amp; Surplus</em><br />Industrial Goods</h1>
            <p>Find dependable machinery from verified Indian sellers—or put your idle equipment to work.</p>
            <div className="hero-search">
              <Search size={19} />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Try “excavator” or “CNC machine”" aria-label="Search equipment" />
              <button onClick={() => navigate('browse')}>Find equipment <ArrowRight size={16} /></button>
            </div>
            <div className="hero-trust">
              <span><ShieldCheck size={16} /> Human verified</span>
              <span><Zap size={16} /> Direct enquiries</span>
              <span><Building2 size={16} /> Across India</span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-image">
              <img src="https://images.unsplash.com/photo-1565793298595-6a879b1d9492?auto=format&fit=crop&w=1200&q=90" alt="Industrial machinery in a modern workshop" />
              <div className="image-label"><span className="status-dot" /> The equipment marketplace <strong>{equipment.length}</strong> listings</div>
            </div>
            <div className="floating-stat"><span className="stat-icon"><BadgeCheck size={20} /></span><div><strong>Verified</strong><small>Every listing reviewed</small></div></div>
            <div className="hero-image-note"><span>01</span><span>Machines for real work.</span></div>
          </div>
        </div>
      </section>

      <section className="home-proof container" aria-label="Marketplace highlights">
        <div><span className="proof-icon"><BadgeCheck size={18} /></span><strong>100%</strong><span>verified listings</span></div>
        <div><span className="proof-icon"><Building2 size={18} /></span><strong>Pan-India</strong><span>seller network</span></div>
        <div><span className="proof-icon"><Zap size={18} /></span><strong>One simple</strong><span>way to enquire</span></div>
      </section>

      <section className="choice-strip">
        <div className="container choice-grid">
          <button className="choice-card buy" onClick={() => navigate('browse')}>
            <div className="choice-icon"><Search size={23} /></div>
            <div><span className="card-kicker">For buyers</span><h2>Find your next machine.</h2><p>Compare verified equipment from trusted sellers across India.</p><span className="text-link">Explore equipment <ArrowRight size={16} /></span></div>
            <span className="choice-decoration" aria-hidden="true">01</span>
          </button>
          <button className="choice-card sell" onClick={() => navigate('sell')}>
            <div className="choice-icon"><Upload size={23} /></div>
            <div><span className="card-kicker">For sellers</span><h2>Give good equipment a new job.</h2><p>Reach serious buyers with a listing reviewed by our team.</p><span className="text-link">List your equipment <ArrowRight size={16} /></span></div>
            <span className="choice-decoration" aria-hidden="true">02</span>
          </button>
        </div>
      </section>

      <section className="section container home-categories">
        <SectionHeading eyebrow="The right tool for the job" title="Explore equipment" link="All equipment" onClick={() => navigate('browse')} />
        <p className="home-section-intro">Browse popular categories and get straight to the machines your work needs.</p>
        {loading ? <p className="home-state">Loading categories...</p> : error ? <div className="home-state"><p className="data-error">{error}</p><button className="button button-dark" onClick={loadEquipment}>Try again</button></div> : categoryNames.length ? <div className="category-grid">{categoryNames.map((name, index) => <button className="category-card" key={name} onClick={() => { setSearch(name); navigate('browse') }}><span className={`category-icon ${['blue', 'amber', 'green', 'rose'][index % 4]}`}>⚙</span><span className="category-name">{name}</span><span className="category-count">{equipment.filter(item => item.category === name).length} listings <ArrowRight size={14} /></span></button>)}</div> : <p className="home-state">No published categories yet.</p>}
      </section>

      <section className="section section-muted home-featured">
        <div className="container">
          <SectionHeading eyebrow="Inspected. Approved. Ready." title="Recently verified" link="Browse all equipment" onClick={() => navigate('browse')} />
          <p className="home-section-intro">A closer look at equipment that has passed our review.</p>
          {loading ? <p className="home-state">Loading listings...</p> : error ? <div className="home-state"><p className="data-error">{error}</p><button className="button button-dark" onClick={loadEquipment}>Try again</button></div> : equipment.length ? <div className="listing-grid">{equipment.slice(0, 3).map(item => <EquipmentCard item={item} key={item._id} onClick={() => setSelected(item)} />)}</div> : <p className="home-state">No approved equipment yet.</p>}
        </div>
      </section>

      <section className="section container process-section">
        <SectionHeading eyebrow="Straightforward by design" title="From search to site, made simple." />
        <div className="process-grid">
          <Process icon={<Search />} number="01" title="Discover" text="Search a focused catalog built for Indian businesses." />
          <Process icon={<ClipboardCheck />} number="02" title="Verify" text="Every published listing passes human review by our team." />
          <Process icon={<Truck />} number="03" title="Connect" text="Send a secure enquiry and move the conversation forward." />
        </div>
      </section>

      <section className="trust-banner">
        <div className="container trust-content">
          <div><span className="eyebrow light">Built for confident decisions</span><h2>Good work starts<br /><em>with good equipment.</em></h2></div>
          <div className="trust-points"><span><BadgeCheck /> Verified listing photos</span><span><ShieldCheck /> Secure buyer enquiries</span><span><Sparkles /> Dedicated support</span></div>
          <button className="button light-button" onClick={() => navigate('browse')}>Find your equipment <ArrowRight size={17} /></button>
        </div>
      </section>
    </main>
  )
}
