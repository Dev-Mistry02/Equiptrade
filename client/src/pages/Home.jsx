import { ArrowRight, BadgeCheck, Building2, Check, ChevronLeft, ChevronRight, ClipboardCheck, Handshake, LoaderCircle, Pause, Play, Search, ShieldCheck, Sparkles, Truck, Upload, Zap } from 'lucide-react'
import { memo, useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { EquipmentCard, Process, SectionHeading } from '../components/MarketplaceComponents'
import { equipment as featuredEquipment } from '../data'
import { getCachedListings, setCachedListings } from '../marketplaceCache'

const homeSlides = [
  {
    eyebrow: "India's verified equipment network",
    title: ['Monetize Your', 'Idle Assets & Surplus', 'Industrial Goods'],
    description: 'Find dependable machinery from verified Indian sellers—or put your idle equipment to work.',
    image: '/equipment.png',
    imageAlt: 'Wheel loader ready for work at sunset',
    imageNote: 'Machines for real work.',
    searchPlaceholder: 'Try “excavator” or “CNC machine”',
  },
  {
    eyebrow: 'Find the right machine for the job',
    title: ['Discover', 'Verified Equipment', 'Across India'],
    description: 'Explore reviewed machinery from trusted sellers and find the right fit for your next project.',
    image: featuredEquipment[0].image,
    imageAlt: 'Industrial machinery available from verified sellers',
    imageNote: 'The right machine. Ready.',
    searchPlaceholder: 'Try “CNC machine” or “lathe”',
  },
  {
    eyebrow: 'Give good equipment a new job',
    title: ['Turn Idle', 'Equipment Into', 'Opportunity'],
    description: 'Reach serious buyers, answer enquiries directly, and get more value from machinery you no longer need.',
    image: featuredEquipment[2].image,
    imageAlt: 'Material handling equipment for Indian businesses',
    imageNote: 'Better use for every asset.',
    searchPlaceholder: 'Try “forklift” or “generator”',
  },
]

const HomeSearch = memo(function HomeSearch({ initialSearch, navigate, placeholder, setSearch }) {
  const [query, setQuery] = useState(initialSearch)

  const submitSearch = event => {
    event.preventDefault()
    setSearch(query)
    navigate('browse')
  }

  return (
    <form className="hero-search" onSubmit={submitSearch}>
      <Search size={19} />
      <input
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder={placeholder}
        aria-label="Search equipment"
      />
      <button type="submit">Find equipment <ArrowRight size={16} /></button>
    </form>
  )
})

export default function Home({ navigate, setSelected, onSaveListing, search, setSearch }) {
  const [activeSlide, setActiveSlide] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const cachedHomeData = getCachedListings('home')
  const [homeData, setHomeData] = useState(() => cachedHomeData || {
    listings: [],
    categories: [],
    totalListings: 0,
  })
  const [loading, setLoading] = useState(() => !cachedHomeData)
  const [error, setError] = useState('')
  const loadEquipment = useCallback(async () => {
    const cached = Boolean(getCachedListings('home'))
    if (!cached) setLoading(true)
    setError('')

    try {
      const data = await api.getHomeEquipment()
      setCachedListings('home', data)
      setHomeData(data)
    } catch (requestError) {
      if (cached) {
        console.warn('Unable to refresh cached marketplace listings:', requestError)
      } else {
        setError(requestError.message || 'Unable to load equipment.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEquipment()
  }, [loadEquipment])

  useEffect(() => {
    if (!isAutoPlaying) return undefined

    const interval = window.setInterval(() => {
      setActiveSlide(current => (current + 1) % homeSlides.length)
    }, 4000)

    return () => window.clearInterval(interval)
  }, [isAutoPlaying])

  const equipment = homeData.listings
  const categoryNames = homeData.categories
  const slide = homeSlides[activeSlide]
  const selectSlide = index => setActiveSlide((index + homeSlides.length) % homeSlides.length)
  return (
    <main className="home-page">
      <section
        className="home-hero"
        style={{ '--mobile-hero-image': `url("${slide.image}")` }}
        aria-label="Featured equipment"
        aria-roledescription="carousel"
      >
        <span className="hero-gear" aria-hidden="true">⚙</span>
        <div className="hero container">
          <div className="hero-copy">
            <div className="eyebrow"><span className="pulse-dot" /> {slide.eyebrow}</div>
            <h1 key={`title-${activeSlide}`}>{slide.title[0]}<br /><em>{slide.title[1]}</em><br />{slide.title[2]}</h1>
            <p key={`description-${activeSlide}`}>{slide.description}</p>
            <HomeSearch
              initialSearch={search}
              navigate={navigate}
              placeholder={slide.searchPlaceholder}
              setSearch={setSearch}
            />
            <div className="hero-trust">
              <span><ShieldCheck size={16} /> Human verified</span>
              <span><Zap size={16} /> Direct enquiries</span>
              <span><Building2 size={16} /> Across India</span>
            </div>
            <div className="hero-carousel-controls" role="group" aria-label="Hero carousel controls">
              <button type="button" className="hero-carousel-arrow" onClick={() => selectSlide(activeSlide - 1)} aria-label="Previous slide">
                <ChevronLeft size={18} />
              </button>
              <div className="hero-carousel-pagination" role="group" aria-label="Choose a slide">
                {homeSlides.map((item, index) => (
                  <button
                    type="button"
                    key={item.eyebrow}
                    className={`hero-carousel-dot${activeSlide === index ? ' is-active' : ''}`}
                    onClick={() => selectSlide(index)}
                    aria-label={`Show slide ${index + 1}: ${item.eyebrow}`}
                    aria-current={activeSlide === index ? 'true' : undefined}
                  />
                ))}
              </div>
              <span className="hero-carousel-count"><strong>0{activeSlide + 1}</strong> / 0{homeSlides.length}</span>
              <button
                type="button"
                className="hero-carousel-arrow hero-carousel-play"
                onClick={() => setIsAutoPlaying(current => !current)}
                aria-label={isAutoPlaying ? 'Pause automatic slides' : 'Play automatic slides'}
              >
                {isAutoPlaying ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <button type="button" className="hero-carousel-arrow" onClick={() => selectSlide(activeSlide + 1)} aria-label="Next slide">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="hero-visual" key={`visual-${activeSlide}`}>
            <div className="hero-image">
              <picture>
                <img
                  src={slide.image}
                  sizes="(max-width: 1100px) 45vw, 540px"
                  alt={slide.imageAlt}
                  width="900"
                  height="620"
                  fetchPriority="high"
                  decoding="async"
                />
              </picture>
              <div className="image-label"><span className="status-dot" /> The equipment marketplace <strong>{homeData.totalListings}</strong> listings</div>
            </div>
            <div className="floating-stat"><span className="stat-icon"><BadgeCheck size={20} /></span><div><strong>Verified</strong><small>Every listing reviewed</small></div></div>
            <div className="hero-image-note"><span>0{activeSlide + 1}</span><span>{slide.imageNote}</span></div>
          </div>
        </div>
      </section>

      <section className="home-proof container" aria-label="Marketplace highlights">
        <div><span className="proof-icon"><BadgeCheck size={18} /></span><strong>Post Equipments</strong><span>List Your Idle Assets</span></div>
        <div><span className="proof-icon"><Building2 size={18} /></span><strong>Connect Directly</strong><span>Get Inquiries Directly</span></div>
        <div><span className="proof-icon"><Handshake size={18} /></span><strong>Deal Done</strong><span>with Zero Commission </span></div>
      </section>

      <section className="choice-strip">
        <div className="container choice-grid">
          <button className="choice-card buy" onClick={() => navigate('browse')}>
            <div className="choice-icon"><Search size={23} /></div>
            <div><span className="card-kicker">For buyers</span><h2>Find your Equipment.</h2><p>Compare verified equipment from trusted sellers.</p><span className="text-link">Explore equipment <ArrowRight size={16} /></span></div>
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
        {loading ? <div className="home-category-loader" role="status" aria-label="Loading categories"><LoaderCircle className="action-spinner" size={28} /></div> : error ? <div className="home-state"><p className="data-error">{error}</p><button className="button button-dark" onClick={loadEquipment}>Try again</button></div> : categoryNames.length ? <div className="category-grid">{categoryNames.map((category, index) => <button className="category-card" key={category.name} onClick={() => { setSearch(category.name); navigate('browse') }}><span className={`category-icon ${['blue', 'amber', 'green', 'rose'][index % 4]}`}>⚙</span><span className="category-name">{category.name}</span><span className="category-count">{category.count} listings <ArrowRight size={14} /></span></button>)}</div> : <p className="home-state">No published categories yet.</p>}
      </section>

      <section className="section section-muted home-featured">
        <div className="container">
          <SectionHeading eyebrow="Inspected. Approved. Ready." title="Recently verified" />
          <p className="home-section-intro">A closer look at equipment that has passed our review.</p>
          {loading ? <div className="home-category-loader" role="status" aria-label="Loading verified equipment"><LoaderCircle className="action-spinner" size={28} /></div> : error ? <div className="home-state"><p className="data-error">{error}</p><button className="button button-dark" onClick={loadEquipment}>Try again</button></div> : equipment.length ? <>
            <div className="listing-grid home-featured-grid">{equipment.slice(0, 4).map(item => <EquipmentCard item={item} key={item._id} onClick={() => setSelected(item)} onSave={onSaveListing} imageSizes="(max-width: 700px) 45vw, (max-width: 1099px) 33vw, 25vw" />)}</div>
            <button className="home-browse-all-button" onClick={() => navigate('browse')}>Browse all equipment <ArrowRight size={17} /></button>
          </> : <p className="home-state">No approved equipment yet.</p>}
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

      <section className="home-reference-cta">
        <div className="home-reference-cta-card">
          <span className="home-reference-cta-icon"><Sparkles size={19} /></span>
          <div className="home-reference-cta-copy">
            <span className="home-reference-cta-kicker">Your next move starts here</span>
            <h2>Good equipment.<br /><em>Better possibilities.</em></h2>
            <p>Find a machine for the work ahead—or find a buyer for the one you have.</p>
            <button onClick={() => navigate('browse')}>Explore equipment <ArrowRight size={17} /></button>
            <div className="home-reference-cta-trust">
              <span><Check size={14} /> Human-reviewed listings</span>
              <i aria-hidden="true" />
              <span><Truck size={14} /> Across India</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
