import { Fragment, useCallback, useEffect, useState } from 'react'
import { LoaderCircle, ShieldCheck, Trash2, X, RefreshCw } from 'lucide-react'
import { api } from '../api'

export default function Admin({ notify }) {
  // --------------------------------------------------
  // State
  // --------------------------------------------------

  const [submissions, setSubmissions] = useState([])
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [processingId, setProcessingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const expandedItem = submissions.find(
    (item) => item._id === expandedId
  )

  // --------------------------------------------------
  // Fetch submissions
  // --------------------------------------------------

  const fetchSubmissions = useCallback(
    async ({ showLoader = true, retry = true } = {}) => {
      try {
        if (showLoader) {
          setLoading(true)
        }

        setError('')

        let data = null
        let lastError = null

        /*
         * Try up to 3 times.
         *
         * This helps when the first request fails because
         * the admin token/authentication is still initializing
         * or the backend is temporarily unavailable.
         */
        const maxAttempts = retry ? 3 : 1

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            data = await api.getAdminSubmissions()
            break
          } catch (requestError) {
            lastError = requestError

            if (attempt < maxAttempts) {
              await new Promise((resolve) =>
                setTimeout(resolve, attempt * 500)
              )
            }
          }
        }

        if (data === null) {
          throw lastError || new Error('Failed to load submissions')
        }

        /*
         * Make sure the API response is actually an array.
         */
        const normalizedData = Array.isArray(data)
          ? data
          : Array.isArray(data?.submissions)
            ? data.submissions
            : Array.isArray(data?.data)
              ? data.data
              : []

        setSubmissions(normalizedData)
        setError('')
      } catch (requestError) {
        console.error(
          'Failed to fetch admin submissions:',
          requestError
        )

        setError(
          requestError?.message ||
            'Failed to load seller submissions.'
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    []
  )

  // --------------------------------------------------
  // Initial load
  // --------------------------------------------------

  useEffect(() => {
    let mounted = true

    const loadInitialData = async () => {
      if (!mounted) return

      await fetchSubmissions({
        showLoader: true,
        retry: true,
      })
    }

    loadInitialData()

    return () => {
      mounted = false
    }
  }, [fetchSubmissions])

  // --------------------------------------------------
  // Manual refresh
  // --------------------------------------------------

  const handleRefresh = async () => {
    if (refreshing || loading) return

    setRefreshing(true)

    await fetchSubmissions({
      showLoader: false,
      retry: true,
    })
  }

  // --------------------------------------------------
  // Update submission status
  // --------------------------------------------------

  const updateStatus = async (id, status) => {
    if (processingId) return

    setProcessingId(id)

    try {
      const updated = await api.updateSubmissionStatus(
        id,
        status
      )

      /*
       * Update the row immediately.
       * No page refresh required.
       */
      setSubmissions((items) =>
        items.map((item) =>
          item._id === id
            ? {
                ...item,
                ...updated,
              }
            : item
        )
      )

      notify(
        updated?.emailSent
          ? status === 'approved'
            ? 'Listing approved and seller emailed'
            : 'Listing rejected and seller emailed'
          : status === 'approved'
            ? 'Listing approved, but seller email was not sent'
            : 'Listing rejected, but seller email was not sent'
      )
    } catch (requestError) {
      console.error(
        'Failed to update submission:',
        requestError
      )

      notify(
        requestError?.message ||
          'Failed to update submission'
      )
    } finally {
      setProcessingId(null)
    }
  }

  // --------------------------------------------------
  // Delete submission
  // --------------------------------------------------

  const deleteSubmission = async (item) => {
    const confirmed = window.confirm(
      `Delete "${item.name}"? This removes it from the marketplace.`
    )

    if (!confirmed) return

    try {
      await api.deleteSubmission(item._id)

      /*
       * Remove immediately from UI.
       */
      setSubmissions((items) =>
        items.filter(
          (current) => current._id !== item._id
        )
      )

      /*
       * Close expanded details if the deleted item
       * was currently open.
       */
      if (expandedId === item._id) {
        setExpandedId(null)
      }

      notify('Listing deleted from the marketplace')
    } catch (requestError) {
      console.error(
        'Failed to delete submission:',
        requestError
      )

      notify(
        requestError?.message ||
          'Failed to delete submission'
      )
    }
  }

  // --------------------------------------------------
  // Statistics
  // --------------------------------------------------

  const pending = submissions.filter(
    (item) => item.status === 'pending'
  ).length

  const published = submissions.filter(
    (item) =>
      ['approved', 'published'].includes(item.status)
  ).length

  // --------------------------------------------------
  // Toggle details
  // --------------------------------------------------

  const toggleDetails = (id) => {
    setExpandedId((currentId) =>
      currentId === id ? null : id
    )
  }

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <main className="container page">

      {/* ================================
          ADMIN HEADER
      ================================= */}

      <section className="admin-heading">

        <div>
          <span className="eyebrow">
            Private workspace
          </span>

          <h1>
            Verification desk
          </h1>

          <p>
            Approve or reject seller requests
            before they become visible to buyers.
          </p>
        </div>

        <div className="admin-header-actions">

          {/* <button
            type="button"
            className="admin-refresh-button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            aria-label="Refresh seller requests"
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? 'admin-refresh-spinning'
                  : ''
              }
            />

            {refreshing
              ? 'Refreshing...'
              : 'Refresh'}
          </button> */}

          <span className="admin-chip">
            <ShieldCheck size={15} />
            Middleman access
          </span>

        </div>

      </section>


      {/* ================================
          METRICS
      ================================= */}

      <section className="metric-grid">

        <Metric
          label="Total submissions"
          value={loading ? '—' : submissions.length}
          trend="From database"
        />

        <Metric
          label="Pending review"
          value={loading ? '—' : pending}
          trend="Needs attention"
          warn
        />

        <Metric
          label="Accepted listings"
          value={loading ? '—' : published}
          trend="Visible to buyers"
        />

        <Metric
          label="New enquiries"
          value="—"
          trend="Not connected yet"
        />

      </section>


      {/* ================================
          ERROR MESSAGE
      ================================= */}

      {error && (
        <div className="data-error admin-error-state">

          <p>
            {error}
          </p>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing
              ? 'Trying again...'
              : 'Try again'}
          </button>

        </div>
      )}


      {/* ================================
          SELLER REQUESTS TABLE
      ================================= */}

      <section className="admin-table-wrap">

        <div className="table-head">

          <h2>
            Seller requests
          </h2>

          <button
            type="button"
            className="admin-refresh-small"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            aria-label="Refresh seller requests"
          >
            <RefreshCw
              size={15}
              className={
                refreshing
                  ? 'admin-refresh-spinning'
                  : ''
              }
            />
          </button>

        </div>


        {/* ================================
            LOADING STATE
        ================================= */}

        {loading ? (

          <div
            className="admin-loading"
            role="status"
            aria-live="polite"
          >
            <LoaderCircle
              size={26}
              className="action-spinner"
            />

            <span>
              Loading seller requests...
            </span>
          </div>

        ) : error ? (

          /* ================================
              ERROR STATE
          ================================= */

          <div className="admin-empty-state">

            <p>
              Unable to load seller requests.
            </p>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing
                ? 'Retrying...'
                : 'Retry'}
            </button>

          </div>

        ) : submissions.length === 0 ? (

          /* ================================
              EMPTY STATE
          ================================= */

          <p className="empty-state">
            No seller submissions yet.
          </p>

        ) : (

          /* ================================
              TABLE
          ================================= */

          <table>

            {/* ----------------------------
                Table Header
            ----------------------------- */}

            <thead>

              <tr>

                <th>
                  Equipment
                </th>

                <th>
                  Seller
                </th>

                <th>
                  Expected price
                </th>

                <th>
                  Submitted
                </th>

                <th>
                  Status
                </th>

                <th>
                  Decision
                </th>

                <th>
                  Remove
                </th>

              </tr>

            </thead>


            {/* ----------------------------
                Table Body
            ----------------------------- */}

            <tbody>

              {submissions.map((item) => (

                <Fragment key={item._id}>

                  {/* ==========================
                      MAIN ROW
                  =========================== */}

                  <tr>

                    {/* Equipment */}

                    <td>

                      <button
                        type="button"
                        className="request-details-button"
                        onClick={() =>
                          toggleDetails(item._id)
                        }
                      >

                        <div className="table-equipment">

                          <img
                            src={item.images?.[0] || ''}
                            alt=""
                            loading="lazy"
                          />

                          <span>

                            <strong>
                              {item.name}
                            </strong>

                            <small>
                              {item.category}
                            </small>

                          </span>

                        </div>

                      </button>

                    </td>


                    {/* Seller */}

                    <td data-label="Seller">

                      {item.seller?.name ||
                        'Seller unavailable'}

                      <br />

                      <small>

                        {item.seller?.mobileNumber ? (

                          <a
                            href={`tel:${item.seller.mobileNumber}`}
                          >
                            {item.seller.mobileNumber}
                          </a>

                        ) : (
                          ''
                        )}

                      </small>

                    </td>


                    {/* Price */}

                    <td data-label="Expected price">

                      {item.price
                        ? `₹${Number(
                            item.price
                          ).toLocaleString('en-IN')}`
                        : 'Price on request'}

                    </td>


                    {/* Submitted date */}

                    <td data-label="Submitted">

                      {item.createdAt
                        ? new Date(
                            item.createdAt
                          ).toLocaleDateString(
                            'en-IN'
                          )
                        : '—'}

                    </td>


                    {/* Status */}

                    <td data-label="Status">

                      <span
                        className={`submission-status status-${item.status}`}
                      >
                        {getStatusLabel(
                          item.status
                        )}
                      </span>

                    </td>


                    {/* Decision */}

                    <td data-label="Decision">

                      {item.status === 'pending' ? (

                        <div className="decision-actions">

                          <button
                            type="button"
                            className="approve-button"
                            disabled={
                              processingId !== null
                            }
                            onClick={() =>
                              updateStatus(
                                item._id,
                                'approved'
                              )
                            }
                          >
                            Approve
                          </button>

                          <button
                            type="button"
                            className="reject-button"
                            disabled={
                              processingId !== null
                            }
                            onClick={() =>
                              updateStatus(
                                item._id,
                                'rejected'
                              )
                            }
                          >
                            Reject
                          </button>

                        </div>

                      ) : (

                        <span className="decision-complete">
                          Decision saved
                        </span>

                      )}

                    </td>


                    {/* Delete */}

                    <td data-label="Remove">

                      <button
                        type="button"
                        className="delete-button"
                        aria-label={`Delete ${item.name}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          deleteSubmission(item)
                        }}
                      >

                        <Trash2 size={16} />

                      </button>

                    </td>

                  </tr>


                  {/* ==========================
                      EXPANDED DETAILS
                  =========================== */}

                  {expandedId === item._id && (

                    <tr className="request-details-row">

                      <td colSpan="7">

                        <div className="admin-product-details">

                          <div className="admin-product-image">

                            {item.images?.[0] ? (

                              <img
                                src={item.images[0]}
                                alt={item.name}
                                loading="lazy"
                              />

                            ) : (

                              <span>
                                No image provided
                              </span>

                            )}

                          </div>


                          <div className="admin-product-info">

                            <span className="eyebrow">
                              Product details
                            </span>

                            <h3>
                              {item.name}
                            </h3>

                            <p>
                              {item.description ||
                                'No description provided.'}
                            </p>

                            <div className="admin-product-facts">

                              <span>
                                <b>Category</b>
                                {item.category ||
                                  'Not available'}
                              </span>

                              <span>
                                <b>Brand</b>
                                {item.brand ||
                                  'Not available'}
                              </span>

                              <span>
                                <b>Model</b>
                                {item.model ||
                                  'Not available'}
                              </span>

                              <span>
                                <b>Year</b>
                                {item.year ||
                                  'Not available'}
                              </span>

                              <span>
                                <b>Condition</b>
                                {item.condition ||
                                  'Not available'}
                              </span>

                              <span>
                                <b>Location</b>
                                {item.location ||
                                  'Not available'}
                              </span>

                              <span>
                                <b>Price</b>
                                {item.price
                                  ? `₹${Number(
                                      item.price
                                    ).toLocaleString(
                                      'en-IN'
                                    )}`
                                  : 'Price on request'}
                              </span>

                              <span>
                                <b>Status</b>
                                {getStatusLabel(
                                  item.status
                                )}
                              </span>

                            </div>

                          </div>


                          <div className="admin-seller-details">

                            <span className="eyebrow">
                              Seller details
                            </span>

                            <strong>
                              {item.seller?.name ||
                                'Not available'}
                            </strong>

                            <span>
                              {item.seller?.mobileNumber ||
                                'Phone not available'}
                            </span>

                            <span>
                              {item.seller?.email ||
                                'Email not available'}
                            </span>

                          </div>

                        </div>

                      </td>

                    </tr>

                  )}

                </Fragment>

              ))}

            </tbody>

          </table>

        )}

      </section>


      {/* ================================
          PRODUCT MODAL
      ================================= */}

      {expandedItem && (

        <div
          className="admin-product-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${expandedItem.name} details`}
        >

          <button
            type="button"
            className="admin-product-modal-backdrop"
            aria-label="Close product details"
            onClick={() =>
              setExpandedId(null)
            }
          />

          <section className="admin-product-modal-card">

            <button
              type="button"
              className="admin-product-modal-close"
              aria-label="Close product details"
              onClick={() =>
                setExpandedId(null)
              }
            >
              <X size={18} />
            </button>

            <div className="admin-product-details">

              <div className="admin-product-image">

                {expandedItem.images?.[0] ? (

                  <img
                    src={expandedItem.images[0]}
                    alt={expandedItem.name}
                  />

                ) : (

                  <span>
                    No image provided
                  </span>

                )}

              </div>


              <div className="admin-product-info">

                <span className="eyebrow">
                  Product details
                </span>

                <h3>
                  {expandedItem.name}
                </h3>

                <p>
                  {expandedItem.description ||
                    'No description provided.'}
                </p>

                <div className="admin-product-facts">

                  <span>
                    <b>Category</b>
                    {expandedItem.category ||
                      'Not available'}
                  </span>

                  <span>
                    <b>Brand</b>
                    {expandedItem.brand ||
                      'Not available'}
                  </span>

                  <span>
                    <b>Model</b>
                    {expandedItem.model ||
                      'Not available'}
                  </span>

                  <span>
                    <b>Year</b>
                    {expandedItem.year ||
                      'Not available'}
                  </span>

                  <span>
                    <b>Condition</b>
                    {expandedItem.condition ||
                      'Not available'}
                  </span>

                  <span>
                    <b>Location</b>
                    {expandedItem.location ||
                      'Not available'}
                  </span>

                  <span>
                    <b>Price</b>
                    {expandedItem.price
                      ? `₹${Number(
                          expandedItem.price
                        ).toLocaleString(
                          'en-IN'
                        )}`
                      : 'Price on request'}
                  </span>

                  <span>
                    <b>Status</b>
                    {getStatusLabel(
                      expandedItem.status
                    )}
                  </span>

                </div>

              </div>


              <div className="admin-seller-details">

                <span className="eyebrow">
                  Seller details
                </span>

                <strong>
                  {expandedItem.seller?.name ||
                    'Not available'}
                </strong>

                <span>
                  {expandedItem.seller?.mobileNumber ||
                    'Phone not available'}
                </span>

                <span>
                  {expandedItem.seller?.email ||
                    'Email not available'}
                </span>

              </div>

            </div>

          </section>

        </div>

      )}


      {/* ================================
          PROCESSING TOAST
      ================================= */}

      {processingId && (

        <div
          className="toast action-toast"
          role="status"
          aria-live="polite"
        >

          <LoaderCircle
            className="action-spinner"
            size={18}
          />

          Sending email...

        </div>

      )}

    </main>
  )
}


// ==================================================
// Metric Component
// ==================================================

function Metric({
  label,
  value,
  trend,
  warn,
}) {
  return (
    <div className="metric">

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      <small
        className={
          warn
            ? 'warn-text'
            : ''
        }
      >
        {trend}
      </small>

    </div>
  )
}


// ==================================================
// Status Label Helper
// ==================================================

function getStatusLabel(status) {

  if (
    status === 'approved' ||
    status === 'published'
  ) {
    return 'Approved'
  }

  if (status === 'rejected') {
    return 'Rejected'
  }

  return 'Pending'
}