import {
  ArrowRight,
  Boxes,
  ChevronDown,
  Filter,
  LoaderCircle,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { EquipmentCard } from '../components/MarketplaceComponents'
import { categories, inventoryConditions } from '../data'
import { getCachedListings, setCachedListings } from '../marketplaceCache'
import { isPublicQualityListing } from '../listingQuality'
import { toProductSlug } from '../productSlug'

const exampleSearches = ['DG sets', 'Transformers', 'Industrial motors', 'MRO spares']

function getBrowseCacheKey(search, filters) {
  return `browse:${JSON.stringify({ search, filters })}`
}

export default function Browse({
  search,
  setSearch,
  setSelected,
  onSaveListing,
  navigate,
  initialFilters,
}) {
  const [filters, setFilters] = useState(() => ({
    category: '',
    condition: '',
    inventoryCondition: '',
    oemPartNumber: '',
    location: '',
    minPrice: '',
    maxPrice: '',
    ...initialFilters,
  }))
  const [sort, setSort] = useState(initialFilters?.sort || 'newest')

  const browseCacheKey = getBrowseCacheKey(search, { ...filters, sort })
  const [equipment, setEquipment] = useState(
    () => getCachedListings(browseCacheKey) || []
  )
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(
    () => !getCachedListings(browseCacheKey)
  )
  const [showFilters, setShowFilters] = useState(false)
  const requestVersion = useRef(0)
  const activeRequest = useRef(null)

  useEffect(() => {
    if (!initialFilters) return
    setFilters({
      category: initialFilters.category || '',
      condition: initialFilters.condition || '',
      inventoryCondition: initialFilters.inventoryCondition || '',
      oemPartNumber: initialFilters.oemPartNumber || '',
      location: initialFilters.location || '',
      minPrice: initialFilters.minPrice || '',
      maxPrice: initialFilters.maxPrice || '',
    })
    setSort(initialFilters.sort || 'newest')
  }, [initialFilters])

  useEffect(() => {
    if (window.location.pathname !== '/buy') return
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim().replace(/\s+/g, ' '))
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    if (sort !== 'newest') params.set('sort', sort)
    const query = params.toString()
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}`
    )
  }, [search, filters, sort])
  
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
  const hasPricedListings = equipment.some(item =>
    typeof item.price === 'number' && Number.isFinite(item.price)
  )

  /*
   * Fetch marketplace data
   */
  const fetchEquipment = useCallback(async ({ showLoading = true } = {}) => {
    const requestId = ++requestVersion.current
    const cacheKey = getBrowseCacheKey(search, { ...filters, sort })
    const hasCachedListings = Boolean(getCachedListings(cacheKey))
    activeRequest.current?.abort()

    const controller = new AbortController()
    activeRequest.current = controller

    try {
      setError('')
      if (showLoading && !hasCachedListings) setLoading(true)

      const data = await api.getEquipment({
        search,
        ...filters,
        sort,
      }, {
        signal: controller.signal,
      })

      if (requestId !== requestVersion.current) return

      if (Array.isArray(data)) {
        setCachedListings(cacheKey, data)
        setEquipment(data)
      } else {
        throw new Error('The marketplace returned an unexpected response.')
      }
    } catch (error) {
      if (requestId !== requestVersion.current) return
      console.error('Failed to load marketplace:', error)
      setError(error.message || 'Unable to load marketplace.')
    } finally {
      if (requestId === requestVersion.current) {
        activeRequest.current = null
        setLoading(false)
      }
    }
  }, [search, filters, sort])



  /*
   * Initial loading + search/filter changes
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEquipment()
    }, 250)

    return () => {
      clearTimeout(timer)
      requestVersion.current += 1
      activeRequest.current?.abort()
    }
  }, [fetchEquipment])

  /*
   * Refresh when user returns to tab/window
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchEquipment({ showLoading: false })
      }
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    )

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      )
    }
  }, [fetchEquipment])

  const filtered = equipment.filter(isPublicQualityListing)

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
      inventoryCondition: '',
      oemPartNumber: '',
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
    <main className="container page browse-page">

      {/* PAGE HEADING */}
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            The marketplace
          </span>

          <h1>
            Browse Verified Industrial Equipment
          </h1>

          <p>
            Discover industrial machinery, electrical equipment, surplus inventory, and genuine spare parts from verified sellers.
          </p>
        </div>
      </div>

      <section className="browse-surplus-callout" aria-labelledby="browse-surplus-title">
        <div className="browse-surplus-icon"><Boxes size={22} /></div>
        <div>
          <h2 id="browse-surplus-title">Surplus &amp; Dead Stock</h2>
          <p>Browse surplus or unused equipment, excess inventory, and dead stock.</p>
        </div>
        <button
          type="button"
          className="button button-dark"
          onClick={() => setFilters(current => ({
            ...current,
            category: '',
            inventoryCondition: 'surplus',
          }))}
        >
          View surplus listings
        </button>
      </section>

      {/* TOOLBAR */}
      <div className="browse-toolbar">

        {/* SEARCH */}
        <div className="browse-search">
          <Search size={18} />

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search equipment, brand, OEM part number or location"
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
        <label className="sort-select">
          Sort by:
          <select
            value={sort}
            onChange={event => setSort(event.target.value)}
            aria-label="Sort equipment listings"
          >
            <option value="newest">Newest listings</option>
            <option value="price-asc" disabled={!hasPricedListings}>Price: low to high</option>
            <option value="price-desc" disabled={!hasPricedListings}>Price: high to low</option>
          </select>
          <ChevronDown size={15} aria-hidden="true" />
        </label>

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


          {/* INVENTORY CONDITION */}
          <label className="filter-control">
            Inventory condition
            <select
              name="inventoryCondition"
              value={filters.inventoryCondition}
              onChange={updateFilter}
            >
              <option value="">Any inventory condition</option>
              <option value="surplus">Surplus &amp; dead stock</option>
              {inventoryConditions.map(condition => (
                <option key={condition} value={condition}>{condition}</option>
              ))}
            </select>
          </label>

          {/* OEM PART NUMBER */}
          <label className="filter-control">
            OEM part number
            <input
              name="oemPartNumber"
              value={filters.oemPartNumber}
              onChange={updateFilter}
              placeholder="Enter part number"
            />
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
                    {loading ? '—' : filtered.length}
                  </strong>{' '}
                  {loading ? 'loading listings' : 'matching listings'}
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
                      onSave={onSaveListing}
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
              ) : loading ? (
                <p className="empty-state" role="status">
                  Loading equipment listings…
                </p>
              ) : (
                <section className="browse-no-results" aria-labelledby="browse-no-results-title">
                  <h2 id="browse-no-results-title">No matching equipment found</h2>
                  <p>
                    {search.trim()
                      ? `We couldn’t find a verified listing for “${search.trim()}”.`
                      : 'No verified equipment matches these search and filter options.'}
                  </p>
                  <div className="browse-search-examples" aria-label="Suggested searches">
                    <span>Try searching for:</span>
                    {exampleSearches.map(example => (
                      <button
                        type="button"
                        key={example}
                        onClick={() => {
                          setSearch(example)
                          clearFilters()
                          setSort('newest')
                        }}
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                  <div className="browse-no-results-actions">
                    {activeFilters > 0 && (
                      <button type="button" className="button button-outline" onClick={clearFilters}>
                        Clear filters
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button-dark"
                      onClick={() => navigate('contact', {
                        equipmentSearch:
                          search.trim() ||
                          filters.oemPartNumber ||
                          filters.category ||
                          'industrial equipment',
                      })}
                    >
                      Ask us to help source it <ArrowRight size={16} />
                    </button>
                  </div>
                </section>
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