import {
  ChevronDown,
  Filter,
  LoaderCircle,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { EquipmentCard } from '../components/MarketplaceComponents'
import { categories } from '../data'

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

  /*
   * Fetch marketplace data
   * --------------------------------------------------
   * requestId prevents an older/slower API response
   * from replacing newer data.
   */
  const fetchEquipment = useCallback(async () => {
    const requestId = Date.now()

    try {
      setError('')
      setLoading(true)

      const data = await api.getEquipment({
        search,
        ...filters,
        _t: requestId, // prevents stale cached responses
      })

      /*
       * Only use valid array responses.
       */
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
   * Refresh marketplace whenever user comes back
   * to this browser tab/window.
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
   * Automatically check for newly approved/updated listings
   * every 15 seconds while the page is open.
   *
   * This means the user doesn't need to manually refresh.
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
   * Count active filters
   */
  const activeFilters = Object.values(filters).filter(Boolean).length

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
          className="filter-button"
          onClick={() =>
            setShowFilters(value => !value)
          }
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


      {/* BROWSE LAYOUT */}
      <div
        className={`browse-layout ${
          showFilters ? 'filters-open' : ''
        }`}
      >

        {/* FILTER PANEL */}
        <aside className="filter-panel">

          <div className="filter-title">
            Refine results
            <Filter size={16} />
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

              <option>
                Excellent
              </option>

              <option>
                Like New
              </option>

              <option>
                Good
              </option>

              <option>
                Fair
              </option>
            </select>
          </label>


          {/* PRICE */}
          <label className="filter-control">
            Price range

            <select
              value={`${filters.minPrice}-${filters.maxPrice}`}
              onChange={event => {
                const [
                  minPrice,
                  maxPrice,
                ] = event.target.value.split('-')

                setFilters(current => ({
                  ...current,
                  minPrice,
                  maxPrice,
                }))
              }}
            >
              <option value="-">
                Any price
              </option>

              <option value="0-1000000">
                Under ₹10 lakh
              </option>

              <option value="1000000-2500000">
                ₹10–25 lakh
              </option>

              <option value="2500000-">
                Above ₹25 lakh
              </option>
            </select>
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


          {/* CLEAR */}
          <button
            className="clear-filter"
            onClick={clearFilters}
          >
            Clear all filters
          </button>

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
                      onClick={() =>
                        setSelected(item)
                      }
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