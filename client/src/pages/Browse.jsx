import {
  ChevronDown,
  Filter,
  LoaderCircle,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { EquipmentCard } from '../components/MarketplaceComponents'
import { categories } from '../data'
import { toProductSlug } from './ProductDetail'

export default function Browse({
  search,
  setSearch,
  setSelected,
  navigate,
}) {
  const [equipment, setEquipment] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [filters, setFilters] = useState({
    category: '',
    condition: '',
    location: '',
    minPrice: '',
    maxPrice: '',
  })

  const [showFilters, setShowFilters] = useState(false)
  
  const priceRange = (() => {
    const prices = equipment
      .map(item => Number(item.price))
      .filter(price => Number.isFinite(price) && price > 0)

    if (!prices.length) {
      return {
        min: 0,
        max: 0,
      }
    }

    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    }
  })()

  /*
   * Fetch marketplace data
   */
  const fetchEquipment = useCallback(async () => {
    const requestId = Date.now()

    try {
      setError('')
      setLoading(true)

      const data = await api.getEquipment({
        search,
        ...filters,
        _t: requestId,
      })

      if (Array.isArray(data)) {
        setEquipment(data)
      } else {
        setEquipment([])
      }
    } catch (error) {
      console.error('Failed to load marketplace:', error)
      setError(error.message || 'Unable to load marketplace.')
    } finally {
      setLoading(false)
    }
  }, [search, filters])



  /*
   * Initial loading + search/filter changes
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEquipment()
    }, 250)

    return () => clearTimeout(timer)
  }, [fetchEquipment])

  /*
   * Refresh when user returns to tab/window
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchEquipment()
      }
    }

    const handleFocus = () => {
      fetchEquipment()
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    )

    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      )

      window.removeEventListener('focus', handleFocus)
    }
  }, [fetchEquipment])

  /*
   * Automatically refresh marketplace
   */
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchEquipment()
      }
    }, 15000)

    return () => clearInterval(interval)
  }, [fetchEquipment])

  const filtered = equipment

  /*
   * Update filters
   */
  const updateFilter = event => {
    const { name, value } = event.target

    setFilters(current => ({
      ...current,
      [name]: value,
    }))
  }

  /*
   * Clear filters
   */
  const clearFilters = () => {
    setFilters({
      category: '',
      condition: '',
      location: '',
      minPrice: '',
      maxPrice: '',
    })
  }

  /*
   * Close mobile filter drawer
   */
  const closeFilters = () => {
    setShowFilters(false)
  }

  /*
   * Count active filters
   */
  const activeFilters =
    Object.values(filters).filter(Boolean).length

  return (
    <main className="container page">

      {/* PAGE HEADING */}
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            The marketplace
          </span>

          <h1>
            Make Your Product Sell Here !
          </h1>

          <p>
            Verified listings from businesses and specialists
            across India.
          </p>
        </div>
      </div>


      {/* TOOLBAR */}
      <div className="browse-toolbar">

        {/* SEARCH */}
        <div className="browse-search">
          <Search size={18} />

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, brand, model or location"
          />
        </div>


        {/* FILTER BUTTON */}
        <button
          type="button"
          className="filter-button"
          onClick={() =>
            setShowFilters(current => !current)
          }
          aria-expanded={showFilters}
          aria-controls="marketplace-filters"
        >
          <SlidersHorizontal size={17} />

          Filters

          <span>
            {activeFilters}
          </span>
        </button>


        {/* SORT */}
        <div className="sort-select">
          Sort by:

          <strong>
            Recently added
          </strong>

          <ChevronDown size={15} />
        </div>

      </div>


      {/* MOBILE FILTER BACKDROP */}
      {showFilters && (
        <button
          type="button"
          className="mobile-filter-backdrop"
          aria-label="Close filters"
          onClick={closeFilters}
        />
      )}


      {/* BROWSE LAYOUT */}
      <div
        className={`browse-layout ${showFilters ? 'filters-open' : ''
          }`}
      >

        {/* FILTER PANEL */}
        <aside
          id="marketplace-filters"
          className={`filter-panel ${showFilters ? 'mobile-filter-visible' : ''
            }`}
        >

          {/* FILTER HEADER */}
          <div className="filter-title">

            <span>
              Refine results
            </span>

            <div className="filter-title-actions">

              <Filter
                size={16}
                className="desktop-filter-icon"
              />

              <button
                type="button"
                className="mobile-filter-close"
                onClick={closeFilters}
                aria-label="Close filters"
              >
                <X size={19} />
              </button>

            </div>

          </div>


          {/* CATEGORY */}
          <label className="filter-control">
            Category

            <select
              name="category"
              value={filters.category}
              onChange={updateFilter}
            >
              <option value="">
                All categories
              </option>

              {categories.map(item => (
                <option
                  key={item.name}
                  value={item.name}
                >
                  {item.name}
                </option>
              ))}
            </select>
          </label>


          {/* CONDITION */}
          <label className="filter-control">
            Condition

            <select
              name="condition"
              value={filters.condition}
              onChange={updateFilter}
            >
              <option value="">
                Any condition
              </option>

              <option value="Excellent">
                Excellent
              </option>

              <option value="Like New">
                Like New
              </option>

              <option value="Good">
                Good
              </option>

              <option value="Fair">
                Fair
              </option>
            </select>
          </label>


          {/* PRICE */}
          <label className="filter-control">
            Price range

            <div className="price-range-inputs">

              <div className="price-input">
                <span>Min</span>

                <input
                  type="number"
                  min={priceRange.min}
                  max={priceRange.max}
                  value={filters.minPrice}
                  placeholder={`₹${priceRange.min.toLocaleString('en-IN')}`}
                  onChange={event => {
                    setFilters(current => ({
                      ...current,
                      minPrice: event.target.value,
                    }))
                  }}
                />
              </div>

              <span className="price-range-separator">
                —
              </span>

              <div className="price-input">
                <span>Max</span>

                <input
                  type="number"
                  min={priceRange.min}
                  max={priceRange.max}
                  value={filters.maxPrice}
                  placeholder={`₹${priceRange.max.toLocaleString('en-IN')}`}
                  onChange={event => {
                    setFilters(current => ({
                      ...current,
                      maxPrice: event.target.value,
                    }))
                  }}
                />
              </div>

            </div>

            <small className="price-range-info">
              ₹{priceRange.min.toLocaleString('en-IN')}
              {' — '}
              ₹{priceRange.max.toLocaleString('en-IN')}
            </small>
          </label>


          {/* LOCATION */}
          <label className="filter-control">
            Location

            <input
              name="location"
              value={filters.location}
              onChange={updateFilter}
              placeholder="e.g. Pune"
            />
          </label>


          {/* FILTER ACTIONS */}
          <div className="filter-actions">

            <button
              type="button"
              className="clear-filter"
              onClick={clearFilters}
            >
              Clear all filters
            </button>

            <button
              type="button"
              className="filter-done-button"
              onClick={closeFilters}
            >
              Apply filters
            </button>

          </div>

        </aside>


        {/* RESULTS */}
        <div className="results">

          {error ? (
            <p className="data-error">
              {error}
            </p>
          ) : (
            <>

              {/* RESULTS META */}
              <div className="results-meta">

                <span>
                  <strong>
                    {filtered.length}
                  </strong>{' '}
                  verified listings
                </span>

                <span className="view-toggle">
                  ▦ &nbsp; <span>☷</span>
                </span>

              </div>


              {/* LISTINGS */}
              {filtered.length ? (
                <div className="listing-grid browse-grid">

                  {filtered.map(item => (
                    <EquipmentCard
                      item={item}
                      key={item._id}
                      onClick={() => {
                        const slug = toProductSlug(item.name) || item._id
                        navigate('product-detail', {
                          product: item,
                          slug,
                        })
                      }}
                    />
                  ))}

                </div>
              ) : (
                <p className="empty-state">
                  No published equipment matches your search.
                </p>
              )}

            </>
          )}

        </div>

      </div>


      {/* LOADING TOAST */}
      {loading && (
        <div
          className="toast marketplace-loading-toast"
          role="status"
          aria-live="polite"
        >
          <LoaderCircle
            className="action-spinner"
            size={18}
          />

          Loading marketplace...
        </div>
      )}

    </main>
  )
}