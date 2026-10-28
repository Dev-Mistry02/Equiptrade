import { categories, matchesEquipmentCategory } from './data'

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

export function normalizeCategoryCounts(categoryCounts = []) {
  return categories.map(category => ({
    ...category,
    count: categoryCounts
      .filter(({ name }) =>
        category.aliases.some(alias => alias.toLowerCase() === name?.toLowerCase())
      )
      .reduce((total, item) => total + Number(item.count || 0), 0),
  }))
}

const USER_ACCESS_TOKEN_KEY = 'equiptrade_user_access_token'

function getUserAccessToken() {
  try {
    return localStorage.getItem(USER_ACCESS_TOKEN_KEY) || ''
  } catch (error) {
    console.warn('Unable to read the saved sign-in session:', error)
    return ''
  }
}

export function storeUserAccessToken(token) {
  if (typeof token !== 'string' || !token) return
  try {
    localStorage.setItem(USER_ACCESS_TOKEN_KEY, token)
  } catch (error) {
    console.warn('Unable to persist the sign-in session on this device:', error)
  }
}

export function clearUserAccessToken() {
  try {
    localStorage.removeItem(USER_ACCESS_TOKEN_KEY)
  } catch (error) {
    console.warn('Unable to clear the saved sign-in session:', error)
  }
}

async function request(path, options = {}) {
  let response
  const { timeoutMs = 15000, ...fetchOptions } = options

  const isGetRequest = !(fetchOptions.method && fetchOptions.method.toUpperCase() !== 'GET')

  try {
    const accessToken = getUserAccessToken()
    const isAdminRequest =
      path.startsWith('/admin') || path.startsWith('/auth/admin-')
    const headers = {
      ...(isGetRequest ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken && !isAdminRequest
        ? { Authorization: `Bearer ${accessToken}` }
        : {}),
      ...(fetchOptions.headers || {}),
    }

    response = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers,
      credentials: 'include',
      cache: isGetRequest ? 'default' : 'no-store',
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
      const homeData = await request('/equipment/home', {
        timeoutMs: COLD_START_TIMEOUT_MS,
        cache: 'default',
        ...options,
      })

      return {
        ...homeData,
        categories: normalizeCategoryCounts(homeData.categories),
      }
    } catch (error) {
      if (
        error.status !== 404 ||
        error.message !== 'Equipment listing not found.'
      ) {
        throw error
      }

      return {
        listings: [],
        categories: categories.map(category => ({
          ...category,
          count: 0,
        })),
        totalListings: 0,
      }
    }
  },

  getEquipment: (filters, options = {}) => {
    const params = new URLSearchParams()

    if (
      typeof filters === 'string' &&
      filters
    ) {
      const search = filters.trim().replace(/\s+/g, ' ')
      if (search) params.set('search', search)
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
            const normalizedValue = key === 'search' && typeof value === 'string'
              ? value.trim().replace(/\s+/g, ' ')
              : value
            if (normalizedValue !== '') params.set(key, normalizedValue)
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
    request(`/equipment/${encodeURIComponent(idOrSlug)}`),

  getAdminSubmissions: () =>
    request('/admin/submissions', {
      timeoutMs: COLD_START_TIMEOUT_MS,
    }),

  getAdminLeads: filters => {
    const params = new URLSearchParams()
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== '' && value !== undefined && value !== null) {
        params.set(key, value)
      }
    })
    return request(`/admin/leads${params.size ? `?${params}` : ''}`, {
      timeoutMs: COLD_START_TIMEOUT_MS,
    })
  },

  updateLead: (id, payload) =>
    request(`/admin/leads/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  submitContactEnquiry: (payload, idempotencyKey) =>
    request('/leads', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
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

  updateSubmissionDetails: (id, payload) =>
    request(`/admin/submissions/${id}/details`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  updateSubmissionQualityHold: (id, isQualityHold) =>
    request(`/admin/submissions/${id}/quality-hold`, {
      method: 'PATCH',
      body: JSON.stringify({ isQualityHold }),
    }),

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