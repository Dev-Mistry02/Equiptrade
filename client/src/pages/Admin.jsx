import { Fragment, useCallback, useEffect, useState } from 'react'
import {
  LoaderCircle,
  ShieldCheck,
  Trash2,
  X,
  RefreshCw,
  LayoutDashboard,
  Mail,
  Settings,
  LogOut,
  Sun,
  Moon,
  ArrowLeft,
  Package,
} from 'lucide-react'
import { api } from '../api'
import { formatEquipmentPrice } from '../components/MarketplaceComponents'
import LeadsDashboard from './LeadsDashboard'
import { subscribeToMarketplace, getSocket } from '../socket'
import { invalidateAllListings } from '../marketplaceCache'

function AdminThemeToggle({ theme, onToggle }) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className="admin-sidebar-item admin-sidebar-theme"
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      onClick={onToggle}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      <span>Switch to {nextTheme}</span>
    </button>
  )
}

export default function Admin({
  notify,
  theme,
  sidebarOpen,
  onToggleSidebar,
  onToggleTheme,
  onLogout,
}) {
  const [submissions, setSubmissions] = useState([])
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [processingId, setProcessingId] = useState(null)
  const [oemPartNumberDraft, setOemPartNumberDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeSection, setActiveSection] = useState('submissions')

  const expandedItem = submissions.find(
    (item) => item._id === expandedId
  )

  const navigateToHome = () => {
    onToggleSidebar()
    window.history.pushState({}, '', '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const fetchSubmissions = useCallback(
    async ({ showLoader = true, retry = true } = {}) => {
      try {
        if (showLoader) {
          setLoading(true)
        }

        setError('')

        let data = null
        let lastError = null

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

  /*
   * Socket.io real-time updates: refresh submissions when a listing is
   * marked sold or created so the Sold Items section stays current.
   */
  useEffect(() => {
    const unsubscribe = subscribeToMarketplace(() => {
      invalidateAllListings()
      fetchSubmissions({ showLoader: false, retry: true })
    })

    return unsubscribe
  }, [fetchSubmissions])

  const handleRefresh = async () => {
    if (refreshing || loading) return

    setRefreshing(true)

    await fetchSubmissions({
      showLoader: false,
      retry: true,
    })
  }

  const updateStatus = async (id, status) => {
    if (processingId) return

    setProcessingId(id)

    try {
      const updated = await api.updateSubmissionStatus(
        id,
        status
      )

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

  const updateOemPartNumber = async id => {
    if (processingId) return
    setProcessingId(id)
    try {
      const updated = await api.updateSubmissionDetails(id, {
        oemPartNumber: oemPartNumberDraft,
      })
      setSubmissions(items => items.map(item =>
        item._id === id ? { ...item, ...updated } : item
      ))
      notify('OEM part number updated.')
    } catch (requestError) {
      console.error('Failed to update OEM part number:', requestError)
      notify(requestError.message || 'Failed to update OEM part number.')
    } finally {
      setProcessingId(null)
    }
  }

  const updateQualityHold = async (id, isQualityHold) => {
    if (processingId) return
    setProcessingId(id)
    try {
      const updated = await api.updateSubmissionQualityHold(id, isQualityHold)
      setSubmissions(items => items.map(item =>
        item._id === id ? { ...item, ...updated } : item
      ))
      notify(isQualityHold ? 'Listing placed on quality hold.' : 'Quality hold cleared; listing is active if approved.')
    } catch (requestError) {
      console.error('Failed to update listing quality hold:', requestError)
      notify(requestError.message || 'Unable to update listing quality review.')
    } finally {
      setProcessingId(null)
    }
  }

  const deleteSubmission = async (item) => {
    const confirmed = window.confirm(
      `Delete "${item.name}"? This removes it from the marketplace.`
    )

    if (!confirmed) return

    try {
      await api.deleteSubmission(item._id)

      setSubmissions((items) =>
        items.filter(
          (current) => current._id !== item._id
        )
      )

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

  const pending = submissions.filter(
    (item) => item.status === 'pending'
  ).length

  const published = submissions.filter(
    (item) =>
      ['approved', 'published'].includes(item.status)
  ).length

  const soldItems = submissions.filter((item) => Boolean(item.soldAt))

  const toggleDetails = (id) => {
    if (expandedId !== id) {
      const item = submissions.find(submission => submission._id === id)
      setOemPartNumberDraft(item?.oemPartNumber || '')
    }
    setExpandedId((currentId) =>
      currentId === id ? null : id
    )
  }

  const getStatusLabel = (status) => {
    if (status === 'approved' || status === 'published') {
      return 'Approved'
    }
    if (status === 'rejected') {
      return 'Rejected'
    }
    return 'Pending'
  }

  return (
    <div className="admin-layout">

      {sidebarOpen && (
        <div
          className="admin-sidebar-overlay"
          onClick={onToggleSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={`admin-sidebar${sidebarOpen ? ' admin-sidebar-open' : ''}`}
      >
        <button
          type="button"
          className="admin-sidebar-close"
          onClick={onToggleSidebar}
          aria-label="Close sidebar"
        >
          <X size={20} />
        </button>

        <div className="admin-sidebar-brand">
          <ShieldCheck size={20} />
          <span>EquipTrade Admin</span>
        </div>

        <nav className="admin-sidebar-nav">
          <button
            type="button"
            className={
              activeSection === 'submissions'
                ? 'admin-sidebar-item active'
                : 'admin-sidebar-item'
            }
            onClick={() => {
              setActiveSection('submissions')
              onToggleSidebar()
            }}
          >
            <LayoutDashboard size={16} />
            <span>Seller Requests</span>
          </button>

          <button
            type="button"
            className={
              activeSection === 'leads'
                ? 'admin-sidebar-item active'
                : 'admin-sidebar-item'
            }
            onClick={() => {
              setActiveSection('leads')
              onToggleSidebar()
            }}
          >
            <Mail size={16} />
            <span>Lead Enquiries</span>
          </button>

          <button
            type="button"
            className={
              activeSection === 'settings'
                ? 'admin-sidebar-item active'
                : 'admin-sidebar-item'
            }
            onClick={() => {
              setActiveSection('settings')
              onToggleSidebar()
            }}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>

          <button
            type="button"
            className={
              activeSection === 'sold'
                ? 'admin-sidebar-item active'
                : 'admin-sidebar-item'
            }
            onClick={() => {
              setActiveSection('sold')
              onToggleSidebar()
            }}
          >
            <Package size={16} />
            <span>Sold Items</span>
          </button>

          <AdminThemeToggle theme={theme} onToggle={onToggleTheme} />

          <button
            type="button"
            className="admin-sidebar-item admin-sidebar-logout"
            onClick={() => {
              onToggleSidebar()
              onLogout()
            }}
          >
            <LogOut size={16} />
            <span>Log out</span>
          </button>

          <button
            type="button"
            className="admin-sidebar-item admin-sidebar-back"
            onClick={navigateToHome}
          >
            <ArrowLeft size={16} />
            <span>Back to marketplace</span>
          </button>
        </nav>

        <div className="admin-sidebar-footer">
          <ShieldCheck size={14} />
          <span className="admin-sidebar-footer-text">
            Private verification desk
          </span>
        </div>
      </aside>

      <main className="admin-content">

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
            <span className="admin-chip">
              <ShieldCheck size={15} />
              Middleman access
            </span>
          </div>

        </section>

        {activeSection === 'submissions' && (
          <>
            <LeadsDashboard notify={notify} />

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

            {error && (
              <div className="data-error admin-error-state">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  {refreshing ? 'Trying again...' : 'Try again'}
                </button>
              </div>
            )}

            <section className="admin-table-wrap">
              <div className="table-head">
                <h2>Seller requests</h2>
                <button
                  type="button"
                  className="admin-refresh-small"
                  onClick={handleRefresh}
                  disabled={refreshing || loading}
                  aria-label="Refresh seller requests"
                >
                  <RefreshCw
                    size={15}
                    className={refreshing ? 'admin-refresh-spinning' : ''}
                  />
                </button>
              </div>

              {loading ? (
                <div
                  className="admin-loading"
                  role="status"
                  aria-live="polite"
                >
                  <LoaderCircle size={26} className="action-spinner" />
                  <span>Loading seller requests...</span>
                </div>
              ) : error ? (
                <div className="admin-empty-state">
                  <p>Unable to load seller requests.</p>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing}
                  >
                    {refreshing ? 'Retrying...' : 'Retry'}
                  </button>
                </div>
              ) : submissions.length === 0 ? (
                <p className="empty-state">No seller submissions yet.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Equipment</th>
                      <th>Seller</th>
                      <th>Listing type</th>
                      <th>Asking price</th>
                      <th>Submitted</th>
                      <th>Status</th>
                      <th>Decision</th>
                      <th>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((item) => (
                      <Fragment key={item._id}>
                        <tr>
                          <td>
                            <button
                              type="button"
                              className="request-details-button"
                              onClick={() => toggleDetails(item._id)}
                            >
                              <div className="table-equipment">
                                <img
                                  src={item.images?.[0] || ''}
                                  alt=""
                                  loading="lazy"
                                />
                                <span>
                                  <strong>{item.name}</strong>
                                  <small>{item.category}</small>
                                </span>
                              </div>
                            </button>
                          </td>
                          <td data-label="Seller">
                            {item.seller?.name || 'Seller unavailable'}
                            <br />
                            <small>
                              {item.seller?.mobileNumber ? (
                                <a href={`tel:${item.seller.mobileNumber}`}>
                                  {item.seller.mobileNumber}
                                </a>
                              ) : (
                                ''
                              )}
                            </small>
                          </td>
                          <td data-label="Listing type">
                            {item.listingType === 'rental' ? 'Rent' : 'Sale'}
                          </td>
                          <td data-label="Asking price">
                            {formatEquipmentPrice(item)}
                          </td>
                          <td data-label="Submitted">
                            {item.createdAt
                              ? new Date(item.createdAt).toLocaleDateString('en-IN')
                              : '—'}
                          </td>
                          <td data-label="Status">
                            <span className={`submission-status status-${item.status}`}>
                              {getStatusLabel(item.status)}
                            </span>
                            {item.qualityReviewFlag && (
                              <span className="submission-status status-rejected">
                                Quality review required
                              </span>
                            )}
                          </td>
                          <td data-label="Decision">
                            {item.status === 'pending' ? (
                              <div className="decision-actions">
                                <button
                                  type="button"
                                  className="approve-button"
                                  disabled={processingId !== null}
                                  onClick={() => updateStatus(item._id, 'approved')}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="reject-button"
                                  disabled={processingId !== null}
                                  onClick={() => updateStatus(item._id, 'rejected')}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="decision-complete">Decision saved</span>
                            )}
                          </td>
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

                        {expandedId === item._id && (
                          <tr className="request-details-row">
                            <td colSpan="7">
                              <AdminProductDetails
                                item={item}
                                processingId={processingId}
                                oemPartNumberDraft={oemPartNumberDraft}
                                setOemPartNumberDraft={setOemPartNumberDraft}
                                updateQualityHold={updateQualityHold}
                                updateOemPartNumber={updateOemPartNumber}
                                getStatusLabel={getStatusLabel}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}

        {activeSection === 'leads' && (
          <LeadsDashboard notify={notify} />
        )}

        {activeSection === 'settings' && (
          <section className="admin-settings">
            <h2>Settings</h2>
            <p>Admin settings coming soon.</p>
          </section>
        )}

        {activeSection === 'sold' && (
          <section className="admin-settings">
            <h2>Sold Items</h2>
            <p>Equipment marked as sold by sellers.</p>

            {soldItems.length === 0 ? (
              <p className="empty-state">No sold items yet.</p>
            ) : (
              <section className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Equipment</th>
                      <th>Seller</th>
                      <th>Category</th>
                      <th>Asking price</th>
                      <th>Sold at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {soldItems.map((item) => (
                      <tr key={item._id}>
                        <td>
                          <div className="table-equipment">
                            {item.images?.[0] ? (
                              <img
                                src={item.images[0]}
                                alt={item.name}
                                loading="lazy"
                              />
                            ) : (
                              <span>No image</span>
                            )}
                            <span>
                              <strong>{item.name}</strong>
                              <br />
                              <small>{item.category || 'General'}</small>
                            </span>
                          </div>
                        </td>
                        <td>
                          <strong>{item.seller?.name || 'Seller unavailable'}</strong>
                          <br />
                          <small>{item.seller?.email || 'Email not available'}</small>
                        </td>
                        <td>{item.category || 'General'}</td>
                        <td>{formatEquipmentPrice(item)}</td>
                        <td>
                          {item.soldAt
                            ? new Date(item.soldAt).toLocaleDateString('en-IN', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </section>
        )}

        {processingId && (
          <div
            className="toast action-toast"
            role="status"
            aria-live="polite"
          >
            <LoaderCircle className="action-spinner" size={18} />
            Sending email...
          </div>
        )}

      </main>

      {activeSection === 'submissions' && expandedItem && (
        <div className="admin-product-modal">
          <div
            className="admin-product-modal-backdrop"
            onClick={() => setExpandedId(null)}
            aria-hidden="true"
          />
          <section
            className="admin-product-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-product-modal-title"
          >
            <button
              type="button"
              className="admin-product-modal-close"
              onClick={() => setExpandedId(null)}
              aria-label="Close product details"
            >
              <X size={18} />
            </button>
            <AdminProductDetails
              item={expandedItem}
              processingId={processingId}
              oemPartNumberDraft={oemPartNumberDraft}
              setOemPartNumberDraft={setOemPartNumberDraft}
              updateQualityHold={updateQualityHold}
              updateOemPartNumber={updateOemPartNumber}
              getStatusLabel={getStatusLabel}
              titleId="admin-product-modal-title"
            />
          </section>
        </div>
      )}

    </div>
  )
}

function AdminProductDetails({
  item,
  processingId,
  oemPartNumberDraft,
  setOemPartNumberDraft,
  updateQualityHold,
  updateOemPartNumber,
  getStatusLabel,
  titleId,
}) {
  return (
    <div className="admin-product-details">
      <div className="admin-product-image">
        {item.images?.[0] ? (
          <img
            src={item.images[0]}
            alt={item.name}
            loading="lazy"
          />
        ) : (
          <span>No image provided</span>
        )}
      </div>
      <div className="admin-product-info">
        <span className="eyebrow">Product details</span>
        {item.qualityReviewFlag && (
          <>
            <p className="data-error">
              {item.qualityReviewReason || 'Potential placeholder listing. Review before republishing.'}
            </p>
            <button
              type="button"
              className="button button-dark"
              disabled={processingId === item._id}
              onClick={() => updateQualityHold(item._id, false)}
            >
              Clear quality hold and reactivate
            </button>
          </>
        )}
        <h3 id={titleId}>{item.name}</h3>
        <p>{item.description || 'No description provided.'}</p>
        <div className="admin-product-facts">
          <span><b>Listing type</b> {item.listingType === 'rental' ? 'Rent' : 'Sale'}</span>
          <span><b>Category</b> {item.category || 'Not available'}</span>
          <span><b>Brand</b> {item.brand || 'Not available'}</span>
          <span><b>Model</b> {item.model || 'Not available'}</span>
          {item.oemPartNumber && (<span><b>OEM part number</b> {item.oemPartNumber}</span>)}
          <span><b>Year</b> {item.year || 'Not available'}</span>
          <span><b>Condition</b> {item.condition || 'Not available'}</span>
          {item.inventoryCondition && (<span><b>Inventory condition</b> {item.inventoryCondition}</span>)}
          <span><b>Location</b> {item.location || 'Not available'}</span>
          <span><b>Asking price</b> {formatEquipmentPrice(item)}</span>
          <span><b>Status</b> {getStatusLabel(item.status)}</span>
        </div>
        <form
          className="admin-oem-part-number-form"
          onSubmit={event => {
            event.preventDefault()
            updateOemPartNumber(item._id)
          }}
        >
          <label>
            OEM part number
            <input
              value={oemPartNumberDraft}
              onChange={event => setOemPartNumberDraft(event.target.value)}
              maxLength={120}
              placeholder="Add or update OEM part number"
            />
          </label>
          <button
            type="submit"
            className="button button-dark"
            disabled={processingId === item._id}
          >
            Save part number
          </button>
        </form>
      </div>
      <div className="admin-seller-details">
        <span className="eyebrow">Seller details</span>
        <strong>{item.seller?.name || 'Not available'}</strong>
        <span>{item.seller?.mobileNumber || 'Phone not available'}</span>
        <span>{item.seller?.email || 'Email not available'}</span>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  trend,
  warn,
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small className={warn ? 'warn-text' : ''}>{trend}</small>
    </div>
  )
}