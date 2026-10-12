const HOSTED_API_URL = 'https://backend-6qf7.onrender.com/api'
const COLD_START_TIMEOUT_MS = 60000
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
const isLocalFrontend = ['localhost', '127.0.0.1', '[::1]'].includes(
  window.location.hostname
)
const isLocalApiUrl = url => {
  if (!url) return false

  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(
      new URL(url, window.location.origin).hostname
    )
  } catch {
    return false
  }
}
const configuredApiIsLocal = isLocalApiUrl(configuredApiUrl)
const useDevelopmentProxy =
  import.meta.env.DEV && (!configuredApiUrl || configuredApiIsLocal)
const baseApiUrl = useDevelopmentProxy
  ? ''
  : configuredApiUrl && (isLocalFrontend || !configuredApiIsLocal)
    ? configuredApiUrl
    : HOSTED_API_URL
export const API_URL = useDevelopmentProxy
  ? '/api'
  : baseApiUrl.endsWith('/api')
    ? baseApiUrl.replace(/\/+$/, '')
    : `${baseApiUrl.replace(/\/+$/, '')}/api`

async function request(path, options = {}) {
  let response
  const { timeoutMs = 15000, ...fetchOptions } = options

  try {
    const headers = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers || {}),
    }

    response = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers,
      credentials: 'include',
      cache: 'no-store',
      signal: fetchOptions.signal || AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error(
        'The EquipTrade server did not respond in time. Check the server and database connection, then try again.',
        { cause: error }
      )
    }

    throw new Error(
      `Unable to connect to the EquipTrade server at ${API_URL}. Please try again shortly.`,
      { cause: error }
    )
  }

  if (response.status === 204) {
    return null
  }

  const contentType = response.headers.get('content-type') || ''

  const data = contentType.includes('application/json')
    ? await response.json()
    : {
        message: `Server returned HTTP ${response.status}. Restart the API server and try again.`,
      }

  const method = (fetchOptions.method || 'GET').toUpperCase()
  const requiresUserAuthentication =
    (method === 'POST' && path === '/equipment') ||
    (method === 'POST' && /^\/equipment\/[^/]+\/enquiries$/.test(path)) ||
    (method === 'POST' && path === '/feedback')

  if (
    response.status === 401 &&
    (requiresUserAuthentication || path.startsWith('/admin'))
  ) {
    window.dispatchEvent(
      new CustomEvent('equiptrade:session-expired', {
        detail: {
          scope: path.startsWith('/admin') ? 'admin' : 'user',
        },
      })
    )
  }

  if (!response.ok) {
    const error = new Error(
      data.message || 'Something went wrong'
    )
    error.status = response.status
    error.retryAfterSeconds = Number(
      data.retryAfterSeconds || response.headers.get('Retry-After')
    ) || 0
    throw error
  }

  return data
}

export const api = {
  getSession: () =>
    request('/auth/session', {
      timeoutMs: COLD_START_TIMEOUT_MS,
    }),

  logout: () =>
    request('/auth/logout', {
      method: 'POST',
    }),

  adminLogout: () =>
    request('/auth/admin-logout', {
      method: 'POST',
    }),

  sendOtp: payload =>
    request('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifyOtp: payload =>
    request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminLogin: payload =>
    request('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getHomeEquipment: async options => {
    try {
      return await request('/equipment/home', {
        timeoutMs: COLD_START_TIMEOUT_MS,
        cache: 'default',
        ...options,
      })
    } catch (error) {
      if (
        error.status !== 404 ||
        error.message !== 'Equipment listing not found.'
      ) {
        throw error
      }

      const listings = await api.getEquipment(undefined, options)
      const categoryCounts = new Map()

      listings.forEach(listing => {
        if (listing.category) {
          categoryCounts.set(
            listing.category,
            (categoryCounts.get(listing.category) || 0) + 1
          )
        }
      })

      return {
        listings: listings.slice(0, 3).map(listing => ({
          ...listing,
          images: listing.images?.slice(0, 1) || [],
        })),
        categories: [...categoryCounts]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([name, count]) => ({ name, count })),
        totalListings: listings.length,
      }
    }
  },

  getEquipment: (filters, options = {}) => {
    const params = new URLSearchParams()

    if (
      typeof filters === 'string' &&
      filters
    ) {
      params.set('search', filters)
    }

    if (
      filters &&
      typeof filters === 'object'
    ) {
      Object.entries(filters).forEach(
        ([key, value]) => {
          if (
            value !== '' &&
            value !== undefined &&
            value !== null
          ) {
            params.set(key, value)
          }
        }
      )
    }

    const query = params.toString()

    return request(
      `/equipment${query ? `?${query}` : ''}`,
      {
        timeoutMs: COLD_START_TIMEOUT_MS,
        ...options,
      }
    )
  },

  getEquipmentByIdOrSlug: idOrSlug =>
    request(`/equipment/${encodeURIComponent(idOrSlug)}`, {
      timeoutMs: COLD_START_TIMEOUT_MS,
    }),

  getAdminSubmissions: () =>
    request('/admin/submissions', {
      timeoutMs: COLD_START_TIMEOUT_MS,
    }),

  updateSubmissionStatus: (
    id,
    status
  ) =>
    request(
      `/admin/submissions/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status,
        }),
      }
    ),

  deleteSubmission: id =>
    request(
      `/admin/submissions/${id}`,
      {
        method: 'DELETE',
      }
    ),

  submitEquipment: payload =>
    request('/equipment', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  sendEnquiry: (id, payload) =>
    request(`/equipment/${encodeURIComponent(id)}/enquiries`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  submitServiceFeedback: payload =>
    request('/feedback', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}