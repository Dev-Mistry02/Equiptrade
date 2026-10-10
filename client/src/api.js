const HOSTED_API_URL = 'https://equiptrade-backend.onrender.com/api'
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
const API_URL = useDevelopmentProxy
  ? '/api'
  : baseApiUrl.endsWith('/api')
    ? baseApiUrl.replace(/\/+$/, '')
    : `${baseApiUrl.replace(/\/+$/, '')}/api`

async function request(path, options = {}) {
  let response

  try {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    }

    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include',
      cache: 'no-store',
      signal: options.signal || AbortSignal.timeout(15000),
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

  const method = (options.method || 'GET').toUpperCase()
  const requiresUserAuthentication =
    (method === 'POST' && path === '/equipment') ||
    (method === 'POST' && /^\/equipment\/[^/]+\/enquiries$/.test(path))

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
    throw new Error(
      data.message || 'Something went wrong'
    )
  }

  return data
}

export const api = {
  getSession: () => request('/auth/session'),

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

  getEquipment: filters => {
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
      `/equipment${query ? `?${query}` : ''}`
    )
  },

  getEquipmentByIdOrSlug: idOrSlug =>
    request(`/equipment/${encodeURIComponent(idOrSlug)}`),

  getAdminSubmissions: () =>
    request('/admin/submissions'),

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
}