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
  return <main className="home-page">
    <section className="hero container"><div className="hero-copy"><div className="eyebrow"><span className="pulse-dot" /> India's verified equipment network</div><h1>Equipment that<br /><em>moves business</em> forward.</h1><p>Discover quality machinery from verified sellers, or turn idle equipment into your next opportunity.</p><div className="hero-search"><Search size={19} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search machines, brands or categories" /><button onClick={() => navigate('browse')}>Search <ArrowRight size={16} /></button></div><div className="hero-trust"><span><ShieldCheck size={16} /> Human verified</span><span><Zap size={16} /> Fast enquiries</span><span><Building2 size={16} /> Pan-India network</span></div></div><div className="hero-visual"><div className="hero-image"><img src="https://images.unsplash.com/photo-1565793298595-6a879b1d9492?auto=format&fit=crop&w=1200&q=90" alt="Industrial machine in a workshop" /><div className="image-label"><span className="status-dot" /> Live marketplace <strong>{equipment.length}</strong> listings</div></div><div className="floating-stat"><span className="stat-icon"><BadgeCheck size={20} /></span><div><strong>4.9/5</strong><small>Buyer confidence</small></div></div></div></section>
    <section className="home-proof container" aria-label="Marketplace highlights"><div><strong>100%</strong><span>verified listings</span></div><div><strong>Pan-India</strong><span>seller network</span></div><div><strong>1 simple</strong><span>way to enquire</span></div></section>
    <section className="choice-strip"><div className="container choice-grid"><button className="choice-card buy" onClick={() => navigate('browse')}><div className="choice-icon"><Search size={23} /></div><div><span className="card-kicker">I need equipment</span><h2>Browse the marketplace</h2><p>Compare verified machines, tools and vehicles from across India.</p><span className="text-link">Explore listings <ArrowRight size={16} /></span></div></button><button className="choice-card sell" onClick={() => navigate('sell')}><div className="choice-icon"><Upload size={23} /></div><div><span className="card-kicker">I have equipment</span><h2>List your equipment</h2><p>Reach serious buyers with a listing reviewed by our team.</p><span className="text-link">Start selling <ArrowRight size={16} /></span></div></button></div></section>
    <section className="section container"><SectionHeading eyebrow="Explore the network" title="Find the right fit" link="View all categories" onClick={() => navigate('browse')} />{loading ? <p>Loading categories...</p> : error ? <div><p className="data-error">{error}</p><button className="button button-dark" onClick={loadEquipment}>Try again</button></div> : categoryNames.length ? <div className="category-grid">{categoryNames.map((name, index) => <button className="category-card" key={name} onClick={() => { setSearch(name); navigate('browse') }}><span className={`category-icon ${['blue', 'amber', 'green', 'rose'][index % 4]}`}>⚙</span><span className="category-name">{name}</span><span className="category-count">{equipment.filter(item => item.category === name).length} listings <ArrowRight size={14} /></span></button>)}</div> : <p>No published categories yet.</p>}</section>
    <section className="section section-muted"><div className="container"><SectionHeading eyebrow="Recently verified" title="Machines worth a closer look" link="Browse all equipment" onClick={() => navigate('browse')} />{loading ? <p>Loading listings...</p> : error ? <div><p className="data-error">{error}</p><button className="button button-dark" onClick={loadEquipment}>Try again</button></div> : equipment.length ? <div className="listing-grid">{equipment.slice(0, 3).map(item => <EquipmentCard item={item} key={item._id} onClick={() => setSelected(item)} />)}</div> : <p>No approved equipment yet.</p>}</div></section>
    <section className="section container process-section"><SectionHeading eyebrow="The EquipTrade standard" title="  to start. Serious about trust." /><div className="process-grid"><Process icon={<Search />} number="01" title="Discover" text="Search a focused catalog built for Indian businesses." /><Process icon={<ClipboardCheck />} number="02" title="Verify" text="Every published listing passes human review by our team." /><Process icon={<Truck />} number="03" title="Connect" text="Send a secure enquiry and move the conversation forward." /></div></section>
    <section className="trust-banner"><div className="container trust-content"><div><span className="eyebrow light">Built for confident decisions</span><h2>Less uncertainty.<br /><em>More momentum.</em></h2></div><div className="trust-points"><span><BadgeCheck /> Verified listing photos</span><span><ShieldCheck /> Secure buyer enquiries</span><span><Sparkles /> Dedicated support</span></div><button className="button light-button" onClick={() => navigate('browse')}>See how it works <ArrowRight size={17} /></button></div></section>
  </main>
}
