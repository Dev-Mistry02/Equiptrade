import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, LoaderCircle, Search } from 'lucide-react'
import { api } from '../api'

const LEAD_STATUSES = ['New', 'Contacted', 'In Progress', 'Converted', 'Closed']

const EMPTY_SUMMARY = { total: 0, new: 0, inProgress: 0, converted: 0 }

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function LeadsDashboard({ notify }) {
  const [leads, setLeads] = useState([])
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 })
  const [searchDraft, setSearchDraft] = useState('')
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  })
  const [expandedId, setExpandedId] = useState('')
  const [notesDraft, setNotesDraft] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [error, setError] = useState('')

  const loadLeads = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getAdminLeads(filters)
      if (!Array.isArray(data.leads) || !data.pagination || !data.summary) {
        throw new Error('The server returned an unexpected enquiry response.')
      }
      setLeads(data.leads)
      setPagination(data.pagination)
      setSummary(data.summary)
    } catch (requestError) {
      console.error('Failed to load contact enquiries:', requestError)
      setError(requestError.message || 'Unable to load contact enquiries.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  const updateLead = async (lead, changes) => {
    if (savingId) return
    setSavingId(lead._id)
    try {
      const updated = await api.updateLead(lead._id, changes)
      setLeads(items => items.map(item => item._id === updated._id ? updated : item))
      if (changes.internalNotes !== undefined) {
        setNotesDraft(current => ({ ...current, [lead._id]: updated.internalNotes }))
      }
      notify?.('Enquiry updated.')
      if (changes.status) loadLeads()
    } catch (requestError) {
      console.error('Failed to update contact enquiry:', requestError)
      notify?.(requestError.message || 'Unable to update this enquiry.')
    } finally {
      setSavingId('')
    }
  }

  const submitSearch = event => {
    event.preventDefault()
    setFilters(current => ({ ...current, search: searchDraft.trim(), page: 1 }))
  }

  return (
    <section className="admin-leads">
      <header className="admin-leads-heading">
        <div>
          <span className="eyebrow">Contact enquiries</span>
          <h2>Lead management</h2>
          <p>Review Contact Us messages and equipment enquiries.</p>
        </div>
        <button type="button" className="button button-outline" onClick={loadLeads} disabled={loading}>
          Refresh leads
        </button>
      </header>

      <div className="admin-lead-summary" aria-label="Enquiry summary">
        <article><span>Total enquiries</span><strong>{summary.total}</strong></article>
        <article><span>New leads</span><strong>{summary.new}</strong></article>
        <article><span>In progress</span><strong>{summary.inProgress}</strong></article>
        <article><span>Converted</span><strong>{summary.converted}</strong></article>
      </div>

      <form className="admin-lead-filters" onSubmit={submitSearch}>
        <label className="admin-lead-search">
          <span className="sr-only">Search enquiries</span>
          <Search size={17} />
          <input
            value={searchDraft}
            onChange={event => setSearchDraft(event.target.value)}
            placeholder="Search ID, name, email, company, equipment, seller…"
          />
          <button type="submit">Search</button>
        </label>
        <label>
          <span className="sr-only">Filter by status</span>
          <select
            value={filters.status}
            onChange={event => setFilters(current => ({
              ...current,
              status: event.target.value,
              page: 1,
            }))}
          >
            <option value="">All statuses</option>
            {LEAD_STATUSES.map(status => <option key={status}>{status}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Sort enquiries</span>
          <select
            value={`${filters.sortBy}:${filters.sortOrder}`}
            onChange={event => {
              const [sortBy, sortOrder] = event.target.value.split(':')
              setFilters(current => ({ ...current, sortBy, sortOrder, page: 1 }))
            }}
          >
            <option value="createdAt:desc">Newest first</option>
            <option value="createdAt:asc">Oldest first</option>
            <option value="name:asc">Name A–Z</option>
            <option value="name:desc">Name Z–A</option>
          </select>
        </label>
      </form>

      {error && <p className="data-error" role="alert">{error}</p>}
      {loading && <p className="home-state" role="status"><LoaderCircle className="action-spinner" size={18} /> Loading enquiries…</p>}
      {!loading && !error && !leads.length && (
        <p className="empty-state">No enquiries match these filters.</p>
      )}

      {!loading && !error && leads.map(lead => {
        const expanded = expandedId === lead._id
        return (
          <article className="admin-lead-card" key={lead._id}>
            <button
              type="button"
              className="admin-lead-summary-row"
              aria-expanded={expanded}
              onClick={() => {
                setExpandedId(expanded ? '' : lead._id)
                setNotesDraft(current => ({ ...current, [lead._id]: lead.internalNotes || '' }))
              }}
            >
              <span className="admin-lead-id">{lead.leadId}</span>
              <span><strong>{lead.name}</strong><small>{lead.email}</small></span>
              <span>{lead.subject}</span>
              <span className={`submission-status status-${lead.status.toLowerCase().replace(/\s+/g, '-')}`}>{lead.status}</span>
              <time dateTime={lead.createdAt}>{formatDate(lead.createdAt)}</time>
            </button>
            {expanded && (
              <div className="admin-lead-details">
                <dl>
                  <div><dt>Email</dt><dd><a href={`mailto:${lead.email}`}>{lead.email}</a></dd></div>
                  <div><dt>Phone</dt><dd>{lead.phone || 'Not provided'}</dd></div>
                  <div><dt>Company</dt><dd>{lead.company || 'Not provided'}</dd></div>
                  <div><dt>Equipment</dt><dd>{lead.equipmentName || lead.subject}</dd></div>
                  {lead.sellerEmail && (
                    <div><dt>Seller email</dt><dd><a href={`mailto:${lead.sellerEmail}`}>{lead.sellerEmail}</a></dd></div>
                  )}
                  {lead.sellerMobileNumber && (
                    <div><dt>Seller phone</dt><dd><a href={`tel:${lead.sellerMobileNumber}`}>{lead.sellerMobileNumber}</a></dd></div>
                  )}
                  <div><dt>Submitted</dt><dd>{formatDate(lead.createdAt)}</dd></div>
                  <div><dt>Enquiry ID</dt><dd>{lead.leadId}</dd></div>
                </dl>
                <div className="admin-lead-message"><strong>Message</strong><p>{lead.message}</p></div>
                <label className="admin-lead-status-control">
                  Status
                  <select
                    value={lead.status}
                    disabled={savingId === lead._id}
                    onChange={event => updateLead(lead, { status: event.target.value })}
                  >
                    {LEAD_STATUSES.map(status => <option key={status}>{status}</option>)}
                  </select>
                </label>
                <label className="admin-lead-notes">
                  Internal notes
                  <textarea
                    value={notesDraft[lead._id] ?? ''}
                    maxLength={10000}
                    rows={4}
                    onChange={event => setNotesDraft(current => ({
                      ...current,
                      [lead._id]: event.target.value,
                    }))}
                    placeholder="Visible to administrators only"
                  />
                </label>
                <button
                  type="button"
                  className="button button-dark"
                  disabled={savingId === lead._id}
                  onClick={() => updateLead(lead, { internalNotes: notesDraft[lead._id] || '' })}
                >
                  {savingId === lead._id ? 'Saving…' : 'Save internal notes'}
                </button>
              </div>
            )}
          </article>
        )
      })}

      {!loading && !error && pagination.pages > 1 && (
        <nav className="admin-lead-pagination" aria-label="Enquiry pages">
          <span>Page {pagination.page} of {pagination.pages} · {pagination.total} enquiries</span>
          <button
            type="button"
            aria-label="Previous page"
            disabled={pagination.page <= 1}
            onClick={() => setFilters(current => ({ ...current, page: current.page - 1 }))}
          ><ChevronLeft size={17} /></button>
          <button
            type="button"
            aria-label="Next page"
            disabled={pagination.page >= pagination.pages}
            onClick={() => setFilters(current => ({ ...current, page: current.page + 1 }))}
          ><ChevronRight size={17} /></button>
        </nav>
      )}
    </section>
  )
}
