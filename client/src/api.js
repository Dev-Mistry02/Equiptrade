const API_URL = import.meta.env.VITE_API_URL || '/api'

async function request(path, options = {}) {
  let response

  try {
    const adminToken = localStorage.getItem('equiptrade_admin_token')
    const userToken = localStorage.getItem('equiptrade_user_token')

    const headers = {
      'Content-Type': 'application/json',
      ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
      ...(path.startsWith('/admin') && adminToken
        ? { Authorization: `Bearer ${adminToken}` }
        : {}),
      ...(options.headers || {}),
    }

    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      cache: 'no-store',
    })
  } catch {
    throw new Error(
      `Unable to connect to the EquipTrade server at ${API_URL}. Start the server with "npm run dev --prefix server".`
    )
  }

  const contentType = response.headers.get('content-type') || ''

  const data = contentType.includes('application/json')
    ? await response.json()
    : {
        message: `Server returned HTTP ${response.status}. Restart the API server and try again.`,
      }

  if (
    response.status === 401 &&
    !path.startsWith('/admin')
  ) {
    localStorage.removeItem('equiptrade_user_token')
    localStorage.removeItem('equiptrade_user_expires_at')
    localStorage.removeItem('equiptrade_user')
  }

  if (!response.ok) {
    throw new Error(
      data.message || 'Something went wrong'
    )
  }

  return data
}

export const api = {
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
}