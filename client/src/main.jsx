import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Building2,
  ChevronDown,
  ClipboardCheck,
  Cog,
  Filter,
  Heart,
  House,
  LockKeyhole,
  Menu,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Truck,
  Upload,
  UserRound,
  X,
  Zap,
} from 'lucide-react'
import { api } from './api'
import { categories, equipment } from './data'
import HomePage from './pages/Home'
import BrowsePage from './pages/Browse'
import SellPage from './pages/Sell'
import AdminPage from './pages/Admin'
import VerificationPage from './pages/Verification'
import ProductDetailPage, { toProductSlug } from './pages/ProductDetail'
import Footer from './components/Footer'
import './desktop.css'
import './app-overrides.css'

const pathToPage = {
  '/home': 'home',
  '/buy': 'browse',
  '/sell': 'sell',
  '/admin': 'admin',
  '/verification': 'verification',
  '/varification': 'verification',
  '/contact': 'contact',
}

const pageToPath = {
  home: '/home',
  browse: '/buy',
  sell: '/sell',
  admin: '/admin',
  verification: '/verification',
}

function getTokenExpiration(token) {
  try {
    const payload = token.split('.')[1]
    const base64Payload = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payload.length / 4) * 4, '=')
    const claims = JSON.parse(
      atob(base64Payload)
    )
    const expiresAt = Number(claims.exp) * 1000

    return Number.isFinite(expiresAt) && expiresAt > 0
      ? expiresAt
      : 0
  } catch {
    return 0
  }
}

function hasActiveUserSession() {
  const token = localStorage.getItem(
    'equiptrade_user_token'
  )

  if (!token) {
    return false
  }

  const expiresAt = getTokenExpiration(token)

  if (!expiresAt) {
    localStorage.removeItem('equiptrade_user_token')
    localStorage.removeItem('equiptrade_user_expires_at')
    localStorage.removeItem('equiptrade_user')
    return false
  }

  // Use the signed JWT expiry as the source of truth and repair stale
  // client-side expiry values written by older API versions.
  localStorage.setItem('equiptrade_user_expires_at', String(expiresAt))

  if (expiresAt <= Date.now()) {
    localStorage.removeItem(
      'equiptrade_user_token'
    )

    localStorage.removeItem(
      'equiptrade_user_expires_at'
    )

    localStorage.removeItem(
      'equiptrade_user'
    )

    return false
  }

  return true
}

function getProductSlugFromPath(pathname = window.location.pathname) {
  if (pathname.startsWith('/buy/') && pathname.length > 5) {
    return decodeURIComponent(pathname.slice(5)).replace(/\/$/, '')
  }
  return ''
}

function getPageFromPath(pathname = window.location.pathname) {
  if (pathname.startsWith('/buy/') && pathname.length > 5) {
    return 'product-detail'
  }
  return pathToPage[pathname] || 'home'
}

function getStoredAdminSession() {
  const expiresAt = Number(
    localStorage.getItem(
      'equiptrade_admin_expires_at'
    )
  )

  const token = localStorage.getItem(
    'equiptrade_admin_token'
  )

  return Boolean(
    token &&
    expiresAt > Date.now()
  )
}

function getStoredUser() {
  try {
    return JSON.parse(
      localStorage.getItem(
        'equiptrade_user'
      ) || 'null'
    )
  } catch {
    return null
  }
}

function App() {
  const savedAuthDraft = (() => {
    try {
      const draft = JSON.parse(
        localStorage.getItem(
          'equiptrade_auth_draft'
        ) || 'null'
      )

      return draft?.data?.email
        ? {
          step: draft.step === 'otp' ? 'otp' : 'details',
          data: draft.data,
        }
        : {
          step: 'details',
          data: {
            name: '',
            mobileNumber: '',
            email: '',
          },
        }
    } catch {
      return {
        step: 'details',
        data: {
          name: '',
          mobileNumber: '',
          email: '',
        },
      }
    }
  })()

  const [verified, setVerified] = useState(
    hasActiveUserSession
  )

  const [adminAuthenticated, setAdminAuthenticated] =
    useState(getStoredAdminSession)

  const [page, setPage] = useState(() => {
    const slug = getProductSlugFromPath()
    if (slug) {
      return 'product-detail'
    }

    if (
      !hasActiveUserSession() &&
      window.location.pathname !== pageToPath.admin
    ) {
      return 'home'
    }

    return getPageFromPath()
  })

  const [productSlug, setProductSlug] = useState(() =>
    getProductSlugFromPath()
  )
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [pendingPageOptions, setPendingPageOptions] = useState(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [verificationOpen, setVerificationOpen] =
    useState(false)
  const [pendingPage, setPendingPage] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)
  const [authStep, setAuthStep] = useState(savedAuthDraft.step)
  const [authData, setAuthData] = useState(
    savedAuthDraft.data
  )
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [authError, setAuthError] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)

  const user = getStoredUser()

  useEffect(() => {
    if (!verified && authData.email) {
      localStorage.setItem(
        'equiptrade_auth_draft',
        JSON.stringify({
          step: authStep,
          data: authData,
        })
      )
    }
  }, [
    authStep,
    authData,
    verified,
  ])

  useEffect(() => {
    const restoreVerificationStep = () => {
      if (hasActiveUserSession()) return

      try {
        const draft = JSON.parse(
          localStorage.getItem('equiptrade_auth_draft') || 'null'
        )

        if (draft?.step === 'otp' && draft.data?.email) {
          setAuthData(draft.data)
          setAuthStep('otp')
          setOtp('')
        }
      } catch {
        localStorage.removeItem('equiptrade_auth_draft')
      }
    }

    window.addEventListener('popstate', restoreVerificationStep)
    return () => window.removeEventListener('popstate', restoreVerificationStep)
  }, [])

  useEffect(() => {
    const checkUserSession = () => {
      const authenticated =
        hasActiveUserSession()

      if (!authenticated && verified) {
        setVerified(false)
        setProfileOpen(false)
      }

      if (authenticated && !verified) {
        setVerified(true)
      }
    }

    checkUserSession()

    const interval = setInterval(
      checkUserSession,
      60 * 1000
    )

    window.addEventListener(
      'focus',
      checkUserSession
    )

    return () => {
      clearInterval(interval)
      window.removeEventListener(
        'focus',
        checkUserSession
      )
    }
  }, [verified])

  useEffect(() => {
    const handlePopState = () => {
      const authenticated =
        hasActiveUserSession()

      if (
        authenticated &&
        window.location.pathname ===
        pageToPath.verification
      ) {
        window.history.replaceState(
          {},
          '',
          pageToPath.home
        )

        setPage('home')
        setVerificationOpen(false)

        return
      }

      if (
        !authenticated &&
        window.location.pathname !==
        pageToPath.home &&
        window.location.pathname !==
        pageToPath.verification &&
        window.location.pathname !==
        pageToPath.admin
      ) {
        window.history.replaceState(
          {},
          '',
          pageToPath.home
        )

        setPage('home')

        return
      }

      if (
        window.location.pathname ===
        pageToPath.verification
      ) {
        setVerificationOpen(true)
        setPage('home')

        return
      }

      setVerificationOpen(false)
      const currentSlug = getProductSlugFromPath()
      if (currentSlug) {
        setProductSlug(currentSlug)
        setPage('product-detail')
        return
      }
      setPage(getPageFromPath())
    }

    window.addEventListener(
      'popstate',
      handlePopState
    )

    const authenticated =
      hasActiveUserSession()

    if (
      authenticated &&
      window.location.pathname ===
      pageToPath.verification
    ) {
      window.history.replaceState(
        {},
        '',
        pageToPath.home
      )

      setPage('home')
      setVerificationOpen(false)
    }

    if (
      !authenticated &&
      window.location.pathname !==
      pageToPath.home &&
      window.location.pathname !==
      pageToPath.verification &&
      window.location.pathname !==
      pageToPath.admin &&
      !getProductSlugFromPath(window.location.pathname)
    ) {
      window.history.replaceState(
        {},
        '',
        pageToPath.home
      )
    } else if (
      !pathToPage[
      window.location.pathname
      ] &&
      !getProductSlugFromPath(window.location.pathname)
    ) {
      window.history.replaceState(
        {},
        '',
        pageToPath.home
      )
    }

    if (
      !authenticated &&
      window.location.pathname ===
      pageToPath.verification
    ) {
      setVerificationOpen(true)
      setPage('home')
    }

    return () =>
      window.removeEventListener(
        'popstate',
        handlePopState
      )
  }, [verified])

  const notify = message => {
    setToast(message)

    setTimeout(
      () => setToast(''),
      3000
    )
  }

  const sendOtp = async event => {
    event.preventDefault()

    setLoading(true)
    setAuthError('')
    setOtp('')

    try {
      const response = await api.sendOtp({
        name: authData.name.trim(),
        mobileNumber: authData.mobileNumber.trim(),
        email: authData.email.trim().toLowerCase(),
      })

      if (response.email && response.email !== authData.email) {
        setAuthData(current => ({
          ...current,
          email: response.email,
        }))
      }
      setAuthStep('otp')
      notify(
        response.email
          ? `Verification code sent to ${response.email}.`
          : 'Verification code sent to your email.'
      )
    } catch (error) {
      setAuthError(
        error.message ||
        'Unable to send the verification code. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async event => {
    event.preventDefault()

    setLoading(true)
    setAuthError('')

    try {
      const response = await api.verifyOtp({
        email: authData.email,
        otp,
      })

      if (!response?.token) {
        throw new Error('Login token was not received from the server.')
      }

      const expiresAt = getTokenExpiration(response.token)
      if (!expiresAt) {
        throw new Error('The server returned an invalid login token. Please try again.')
      }

      localStorage.setItem('equiptrade_user_token', response.token)
      localStorage.setItem('equiptrade_user_expires_at', String(expiresAt))
      localStorage.setItem('equiptrade_user', JSON.stringify(response.user))
      localStorage.removeItem('equiptrade_auth_draft')

      setVerified(true)
      setVerificationOpen(false)

      const destination = pendingPage
      const destinationOptions = pendingPageOptions
      const action = pendingAction
      setPendingPage(null)
      setPendingPageOptions(null)
      setPendingAction(null)

      if (destination) {
        navigate(destination, destinationOptions || {})
      } else if (action) {
        window.history.replaceState({}, '', pageToPath.home)
        action()
      }

      notify('Account verified. Welcome to EquipTrade.')
    } catch (error) {
      setAuthError(
        error.message ||
        'Unable to verify the code. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem(
      'equiptrade_user_token'
    )

    localStorage.removeItem(
      'equiptrade_user_expires_at'
    )

    localStorage.removeItem(
      'equiptrade_user'
    )

    localStorage.removeItem(
      'equiptrade_auth_draft'
    )

    setProfileOpen(false)
    setVerified(false)
    setVerificationOpen(false)
    setPendingPage(null)
    setPendingAction(null)
    setAuthStep('details')
    setAuthData({
      name: '',
      mobileNumber: '',
      email: '',
    })
    setOtp('')

    navigate('home')
  }

  const adminLogout = () => {
    localStorage.removeItem(
      'equiptrade_admin_token'
    )

    localStorage.removeItem(
      'equiptrade_admin_expires_at'
    )

    setAdminAuthenticated(false)
  }

  const navigate = (nextPage, options = {}) => {
    let nextPath = pageToPath[nextPage]

    if (nextPage === 'product-detail') {
      const slug =
        options.slug ||
        (options.product?.name ? toProductSlug(options.product.name) : '')
      nextPath = `/buy/${slug}`
      setSelectedProduct(options.product || null)
      setProductSlug(slug)
    } else if (typeof nextPage === 'string' && nextPage.startsWith('/')) {
      nextPath = nextPage
      if (nextPage.startsWith('/buy/') && nextPage.length > 5) {
        nextPage = 'product-detail'
        const slug = decodeURIComponent(nextPath.slice(5)).replace(/\/$/, '')
        setSelectedProduct(options.product || null)
        setProductSlug(slug)
      } else {
        nextPage = pathToPage[nextPath] || 'home'
      }
    }

    if (
      nextPath &&
      window.location.pathname !==
      nextPath
    ) {
      window.history.pushState(
        {},
        '',
        nextPath
      )
    }

    if (nextPage !== 'admin' && nextPage !== 'product-detail') {
      localStorage.setItem(
        'equiptrade_page',
        nextPage
      )
    }

    setPage(nextPage)
    setMobileMenu(false)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const guardedNavigate = (nextPage, options = {}) => {
    const authenticated =
      hasActiveUserSession()

    if (
      authenticated &&
      !verified
    ) {
      setVerified(true)
    }

    if (
      !authenticated &&
      nextPage !== 'home' &&
      nextPage !== 'admin'
    ) {
      setPendingPage(nextPage)
      setPendingPageOptions(options)
      setPendingAction(null)

      window.history.pushState(
        {},
        '',
        pageToPath.verification
      )

      setVerificationOpen(true)

      return
    }

    navigate(nextPage, options)
  }

  const requireVerification = action => {
    const authenticated =
      hasActiveUserSession()

    if (
      authenticated &&
      !verified
    ) {
      setVerified(true)
    }

    if (authenticated) {
      action()
      return
    }

    setPendingPage(null)
    setPendingAction(
      () => action
    )

    window.history.pushState(
      {},
      '',
      pageToPath.verification
    )

    setVerificationOpen(true)
  }

  const handleProfileClick = () => {
    const authenticated =
      hasActiveUserSession()

    if (
      authenticated &&
      !verified
    ) {
      setVerified(true)
    }

    if (authenticated) {
      setProfileOpen(
        value => !value
      )

      return
    }

    setPendingPage(null)

    setPendingAction(
      () =>
        () =>
          setProfileOpen(true)
    )

    window.history.pushState(
      {},
      '',
      pageToPath.verification
    )

    setVerificationOpen(true)
  }

  if (
    verificationOpen &&
    !hasActiveUserSession()
  ) {
    return (
      <VerificationPage
        step={authStep}
        data={authData}
        setData={setAuthData}
        otp={otp}
        setOtp={setOtp}
        onSend={sendOtp}
        onVerify={verifyOtp}
        onChangeEmail={() => {
          setAuthStep('details')
          setOtp('')
          setAuthError('')
        }}
        loading={loading}
        error={authError}
      />
    )
  }

  if (
    page === 'admin' &&
    !adminAuthenticated
  ) {
    return (
      <AdminLogin
        onLogin={() =>
          setAdminAuthenticated(true)
        }
      />
    )
  }

  if (page === 'admin') {
    return (
      <div className="admin-shell">
        <AdminHeader
          navigate={navigate}
          onLogout={adminLogout}
        />

        <AdminPage notify={notify} />

        {toast && (
          <div className="toast">
            <BadgeCheck size={18} />
            {toast}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">

        <button
          className="brand"
          onClick={() =>
            navigate('home')
          }
          aria-label="EquipTrade India home"
        >
          <span className="brand-mark">
            <Cog size={19} />
          </span>

          <span>
            equip<span>trade</span>
            <small>INDIA</small>
          </span>
        </button>

        <nav
          className={
            mobileMenu
              ? 'main-nav open'
              : 'main-nav'
          }
        >
          <button
            className={
              page === 'home'
                ? 'nav-link active'
                : 'nav-link'
            }
            onClick={() =>
              navigate('home')
            }
          >
            Home
          </button>

          <button
            className={
              page === 'browse' || page === 'product-detail'
                ? 'nav-link active'
                : 'nav-link'
            }
            onClick={() =>
              guardedNavigate('browse')
            }
          >
            Buy equipment
          </button>

          <button
            className={
              page === 'sell'
                ? 'nav-link active'
                : 'nav-link'
            }
            onClick={() =>
              guardedNavigate('sell')
            }
          >
            Sell equipment
          </button>

          <button
            className="nav-link"
            onClick={() =>
              notify(
                'Our equipment specialists are here to help.'
              )
            }
          >
            Contact
          </button>
        </nav>

        <div className="top-actions">

          {/* <button
            className="icon-btn"
            aria-label="Notifications"
            onClick={() =>
              notify(
                'No new notifications'
              )
            }
          >
            <Bell size={18} />
          </button> */}

          <div className="profile-menu">

            <button
              className="avatar-btn"
              aria-label={
                verified
                  ? 'Open profile'
                  : 'Log in to view profile'
              }
              aria-expanded={
                profileOpen
              }
              onClick={
                handleProfileClick
              }
            >
              <UserRound size={17} />
            </button>

            {profileOpen && (
              <AccountPanel
                user={user}
                close={() =>
                  setProfileOpen(false)
                }
                onLogout={logout}
              />
            )}
            {profileOpen && (
              <div className="mobile-profile-wrapper">
                <AccountPanel
                  user={user}
                  close={() => setProfileOpen(false)}
                  onLogout={logout}
                />
              </div>
            )}

          </div>

          <button
            className="menu-toggle"
            onClick={() =>
              setMobileMenu(
                !mobileMenu
              )
            }
            aria-label="Toggle menu"
          >
            {mobileMenu ? (
              <X />
            ) : (
              <Menu />
            )}
          </button>

        </div>

      </header>


      <MobileDock
        page={page}
        navigate={guardedNavigate}
        onProfile={handleProfileClick}
        profileOpen={profileOpen}
      />
      {profileOpen && (
        <div className="mobile-profile-card">
          <div className="mobile-profile-header">
            <div>
              <h3>{user?.name || 'My Account'}</h3>
              <p>
                {user?.email || user?.mobileNumber || ''}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setProfileOpen(false)}
              className="mobile-profile-close"
              aria-label="Close profile"
            >
              ×
            </button>
          </div>

          <div className="mobile-profile-info">
            <div className="mobile-profile-row">
              <span>Name</span>
              <strong>{user?.name || 'Not available'}</strong>
            </div>

            <div className="mobile-profile-row">
              <span>Email</span>
              <strong>{user?.email || 'Not available'}</strong>
            </div>

            <div className="mobile-profile-row">
              <span>Mobile</span>
              <strong>
                {user?.mobileNumber || 'Not available'}
              </strong>
            </div>
          </div>

          <button
            type="button"
            className="mobile-profile-logout"
            onClick={logout}
          >
            Log out
          </button>
        </div>
      )}

      {page === 'home' && (
        <HomePage
          navigate={guardedNavigate}
          setSelected={item => {
            const slug = toProductSlug(item?.name) || item?._id
            guardedNavigate('product-detail', { product: item, slug })
          }}
          search={search}
          setSearch={setSearch}
        />
      )}

      {page === 'browse' && (
        <BrowsePage
          search={search}
          setSearch={setSearch}
          setSelected={item => {
            const slug = toProductSlug(item?.name) || item?._id
            guardedNavigate('product-detail', { product: item, slug })
          }}
          navigate={guardedNavigate}
        />
      )}

      {page === 'product-detail' && (
        <ProductDetailPage
          slug={productSlug}
          product={selectedProduct}
          navigate={guardedNavigate}
          notify={notify}
          requireVerification={requireVerification}
          user={user}
        />
      )}

      {page === 'sell' && (
        <SellPage
          notify={notify}
          navigate={guardedNavigate}
          user={user}
        />
      )}

      {selected && (
        <Details
          item={selected}
          close={() =>
            setSelected(null)
          }
          notify={notify}
        />
      )}

      <Footer
        navigate={guardedNavigate}
        notify={notify}
      />

      {toast && (
        <div className="toast">
          <BadgeCheck size={18} />
          {toast}
        </div>
      )}
    </div>
  )
}
function MobileDock({ page, navigate, onProfile, profileOpen }) {
  return (
    <nav className="mobile-dock" aria-label="Quick navigation">
      <button
        className={page === 'home' ? 'mobile-dock-item active' : 'mobile-dock-item'}
        onClick={() => navigate('home')}
      >
        <House size={19} />
        <span>Home</span>
      </button>
      <button
        className={page === 'browse' || page === 'product-detail' ? 'mobile-dock-item active' : 'mobile-dock-item'}
        onClick={() => navigate('browse')}
      >
        <Search size={19} />
        <span>Buy item</span>
      </button>
      <button
        className="mobile-dock-item"
        onClick={() => navigate('sell')}
      >
        <Upload size={18} />
        <span>Sell item</span>
      </button>
      <button
        className={profileOpen ? 'mobile-dock-item active' : 'mobile-dock-item'}
        onClick={onProfile}
      >
        <UserRound size={19} />
        <span>Account</span>
      </button>
    </nav>
  )
}

function AccountPanel({
  user,
  close,
  onLogout,
}) {
  return (
    <div
      className="account-panel"
      role="dialog"
      aria-label="Your profile"
    >
      <div className="account-panel-header">

        <div className="account-avatar">
          <UserRound size={18} />
        </div>

        <div>
          <strong>
            {user?.name ||
              'Verified user'}
          </strong>

          <span>
            Verified account
          </span>
        </div>

        <button
          className="account-close"
          aria-label="Close profile"
          onClick={close}
        >
          <X size={16} />
        </button>

      </div>

      <div className="account-details">

        <div>
          <span>Name</span>
          <strong>
            {user?.name ||
              'Not available'}
          </strong>
        </div>

        <div>
          <span>Email</span>
          <strong>
            {user?.email ||
              'Not available'}
          </strong>
        </div>

        <div>
          <span>Mobile number</span>
          <strong>
            {user?.mobileNumber ||
              'Not available'}
          </strong>
        </div>

      </div>

      <button
        className="logout-button"
        onClick={onLogout}
      >
        Log out
      </button>
    </div>
  )
}

function AdminHeader({
  navigate,
  onLogout,
}) {
  return (
    <header className="admin-topbar">

      <button
        className="brand"
        onClick={() =>
          navigate('admin')
        }
        aria-label="EquipTrade India admin home"
      >
        <span className="brand-mark">
          <Cog size={19} />
        </span>

        <span>
          equip<span>trade</span>
          <small>ADMIN</small>
        </span>
      </button>

      <div className="admin-topbar-actions">

        <span className="admin-context">
          <ShieldCheck size={15} />
          Private verification desk
        </span>

        <button
          className="button button-outline"
          onClick={onLogout}
        >
          Log out
        </button>

        <button
          className="button button-outline"
          onClick={() => {
            window.history.pushState(
              {},
              '',
              '/'
            )
            navigate('home')
          }}
        >
          Back to marketplace
          <ArrowRight size={15} />
        </button>

      </div>
    </header>
  )
}

function AdminLogin({ onLogin }) {
  const [credentials, setCredentials] =
    useState({
      name: '',
      password: '',
    })

  const [error, setError] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  const submit = async event => {
    event.preventDefault()

    setLoading(true)
    setError('')

    try {
      const response =
        await api.adminLogin(
          credentials
        )

      localStorage.setItem(
        'equiptrade_admin_token',
        response.token
      )

      localStorage.setItem(
        'equiptrade_admin_expires_at',
        String(
          Date.now() +
          response.expiresIn
        )
      )

      onLogin()
    } catch (requestError) {
      setError(
        requestError.message ||
        'Unable to sign in.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">

        <div className="admin-login-icon">
          <LockKeyhole size={22} />
        </div>

        <span className="eyebrow">
          Private workspace
        </span>

        <h1>
          Admin sign in
        </h1>

        <p>
          Verify your identity to access
          the EquipTrade verification desk.
        </p>

        <form onSubmit={submit}>

          <label>
            Admin name

            <input
              required
              value={credentials.name}
              onChange={event =>
                setCredentials({
                  ...credentials,
                  name: event.target.value,
                })
              }
              autoComplete="username"
            />
          </label>

          <label>
            Password

            <input
              required
              type="password"
              value={credentials.password}
              onChange={event =>
                setCredentials({
                  ...credentials,
                  password:
                    event.target.value,
                })
              }
              autoComplete="current-password"
            />
          </label>

          {error && (
            <p
              className="verification-error"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            className="button button-dark full-button"
            disabled={loading}
          >
            {loading
              ? 'Signing in...'
              : 'Sign in'}

            <ArrowRight size={17} />
          </button>

        </form>
      </section>
    </main>
  )
}

function LegacyHome({
  navigate,
  setSelected,
  search,
  setSearch,
}) {
  return (
    <main>
      <section className="hero container">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="pulse-dot" />
            India's verified equipment network
          </div>

          <h1>
            Equipment that
            <br />
            <em>
              moves business
            </em>{' '}
            forward.
          </h1>

          <p>
            Discover quality machinery
            from verified sellers, or turn
            idle equipment into your next
            opportunity.
          </p>

          <div className="hero-search">
            <Search size={19} />

            <input
              value={search}
              onChange={e =>
                setSearch(e.target.value)
              }
              placeholder="Search machines, brands or categories"
            />

            <button
              onClick={() =>
                navigate('browse')
              }
            >
              Search
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="hero-trust">
            <span>
              <ShieldCheck size={16} />
              Human verified
            </span>

            <span>
              <Zap size={16} />
              Fast enquiries
            </span>

            <span>
              <Building2 size={16} />
              Pan-India network
            </span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-image">
            <img
              src="https://images.unsplash.com/photo-1565793298595-6a879b1d9492?auto=format&fit=crop&w=1200&q=90"
              alt="Industrial machine in a workshop"
            />

            <div className="image-label">
              <span className="status-dot" />
              Live marketplace
              <strong>312</strong>
              listings
            </div>
          </div>

          <div className="floating-stat">
            <span className="stat-icon">
              <BadgeCheck size={20} />
            </span>

            <div>
              <strong>4.9/5</strong>
              <small>
                Buyer confidence
              </small>
            </div>
          </div>
        </div>
      </section>

      <section className="choice-strip">
        <div className="container choice-grid">

          <button
            className="choice-card buy"
            onClick={() =>
              navigate('browse')
            }
          >
            <div className="choice-icon">
              <Search size={23} />
            </div>

            <div>
              <span className="card-kicker">
                I need equipment
              </span>

              <h2>
                Browse the marketplace
              </h2>

              <p>
                Compare verified machines,
                tools and vehicles from
                across India.
              </p>

              <span className="text-link">
                Explore listings
                <ArrowRight size={16} />
              </span>
            </div>
          </button>

          <button
            className="choice-card sell"
            onClick={() =>
              navigate('sell')
            }
          >
            <div className="choice-icon">
              <Upload size={23} />
            </div>

            <div>
              <span className="card-kicker">
                I have equipment
              </span>

              <h2>
                List your equipment
              </h2>

              <p>
                Reach serious buyers with
                a listing reviewed by our
                team.
              </p>

              <span className="text-link">
                Start selling
                <ArrowRight size={16} />
              </span>
            </div>
          </button>

        </div>
      </section>

      <section className="section container">
        <SectionHeading
          eyebrow="Explore the network"
          title="Find the right fit"
          link="View all categories"
          onClick={() =>
            navigate('browse')
          }
        />

        <div className="category-grid">
          {categories.map(item => (
            <button
              className="category-card"
              key={item.name}
              onClick={() => {
                setSearch(item.name)
                navigate('browse')
              }}
            >
              <span
                className={`category-icon ${item.color}`}
              >
                {item.icon}
              </span>

              <span className="category-name">
                {item.name}
              </span>

              <span className="category-count">
                {item.count}
                <ArrowRight size={14} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="section section-muted">
        <div className="container">

          <SectionHeading
            eyebrow="Recently verified"
            title="Machines worth a closer look"
            link="Browse all equipment"
            onClick={() =>
              navigate('browse')
            }
          />

          <div className="listing-grid">
            {equipment.map(item => (
              <EquipmentCard
                item={item}
                key={item.id}
                onClick={() =>
                  setSelected(item)
                }
              />
            ))}
          </div>

        </div>
      </section>

      <section className="section container process-section">
        <SectionHeading
          eyebrow="The EquipTrade standard"
          title="Simple to start. Serious about trust."
        />

        <div className="process-grid">

          <Process
            icon={<Search />}
            number="01"
            title="Discover"
            text="Search a focused catalog built for Indian businesses."
          />

          <Process
            icon={<ClipboardCheck />}
            number="02"
            title="Verify"
            text="Every published listing passes human review by our team."
          />

          <Process
            icon={<Truck />}
            number="03"
            title="Connect"
            text="Send a secure enquiry and move the conversation forward."
          />

        </div>
      </section>

      <section className="trust-banner">
        <div className="container trust-content">

          <div>
            <span className="eyebrow light">
              Built for confident decisions
            </span>

            <h2>
              Less uncertainty.
              <br />
              <em>
                More momentum.
              </em>
            </h2>
          </div>

          <div className="trust-points">
            <span>
              <BadgeCheck />
              Verified listing photos
            </span>

            <span>
              <ShieldCheck />
              Secure buyer enquiries
            </span>

            <span>
              <Sparkles />
              Dedicated support
            </span>
          </div>

          <button
            className="button light-button"
            onClick={() =>
              navigate('browse')
            }
          >
            See how it works
            <ArrowRight size={17} />
          </button>

        </div>
      </section>
    </main>
  )
}

function LegacyBrowse({
  search,
  setSearch,
  setSelected,
  navigate,
}) {
  const filtered =
    equipment.filter(item =>
      `${item.name} ${item.category} ${item.brand} ${item.location}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )

  return (
    <main className="container page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            The marketplace
          </span>

          <h1>
            Find equipment that earns its keep.
          </h1>

          <p>
            Verified listings from businesses
            and specialists across India.
          </p>
        </div>

        <button
          className="button button-dark"
          onClick={() =>
            navigate('sell')
          }
        >
          <Upload size={17} />
          List equipment
        </button>
      </div>

      <div className="browse-toolbar">
        <div className="browse-search">
          <Search size={18} />

          <input
            value={search}
            onChange={e =>
              setSearch(e.target.value)
            }
            placeholder="Search by name, brand, model or location"
          />
        </div>

        <button className="filter-button">
          <SlidersHorizontal size={17} />
          Filters
          <span>3</span>
        </button>

        <div className="sort-select">
          Sort by:
          <strong>
            Recently added
          </strong>
          <ChevronDown size={15} />
        </div>
      </div>

      <div className="browse-layout">
        <aside className="filter-panel">
          <div className="filter-title">
            Refine results
            <Filter size={16} />
          </div>

          {[
            'Category',
            'Price range',
            'Condition',
            'Location',
            'Equipment type',
          ].map(filter => (
            <div
              className="filter-row"
              key={filter}
            >
              <span>{filter}</span>
              <ChevronDown size={15} />
            </div>
          ))}

          <button className="clear-filter">
            Clear all filters
          </button>
        </aside>

        <div className="results">
          <div className="results-meta">
            <span>
              <strong>
                {filtered.length || 0}
              </strong>{' '}
              verified listings
            </span>

            <span className="view-toggle">
              ▦ &nbsp; <span>☷</span>
            </span>
          </div>

          <div className="listing-grid browse-grid">
            {filtered.map(item => (
              <EquipmentCard
                item={item}
                key={item.id}
                onClick={() =>
                  setSelected(item)
                }
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}

function LegacySell({
  notify,
  navigate,
}) {
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] =
    useState(false)

  const [form, setForm] = useState({
    name: '',
    category: '',
    brand: '',
    model: '',
    year: '',
    condition: '',
    price: '',
    location: '',
    description: '',
  })

  const update = e =>
    setForm({
      ...form,
      [e.target.name]:
        e.target.value,
    })

  const submit = async e => {
    e.preventDefault()
    setSubmitted(true)
    notify(
      'Submitted for marketplace verification'
    )
  }

  if (submitted) {
    return (
      <main className="container page success-page">
        <div className="success-icon">
          <ClipboardCheck size={30} />
        </div>

        <span className="eyebrow">
          Submission received
        </span>

        <h1>
          Your equipment is in
          <br />
          good hands.
        </h1>

        <p>
          Our team is reviewing your details.
          Your listing will appear in the
          marketplace after it is verified.
        </p>

        <div className="status-tracker">
          <span className="done">
            <b>✓</b>
            Submitted
          </span>

          <i />

          <span className="current">
            <b>02</b>
            Under review
          </span>

          <i />

          <span>
            <b>03</b>
            Approved
          </span>

          <i />

          <span>
            <b>04</b>
            Published
          </span>
        </div>

        <button
          className="button button-dark"
          onClick={() =>
            navigate('browse')
          }
        >
          Browse verified equipment
          <ArrowRight size={17} />
        </button>
      </main>
    )
  }

  return (
    <main className="container page sell-page">
      <div className="page-heading">

        <div>
          <span className="eyebrow">
            Seller workspace
          </span>

          <h1>
            Put your equipment
            <br />
            <em>
              back to work.
            </em>
          </h1>

          <p>
            Submit the details once. We’ll
            verify the listing before it
            reaches serious buyers.
          </p>
        </div>

        <div className="step-count">
          Step <strong>{step}</strong> of 3
        </div>

      </div>

      <div className="form-layout">

        <div className="form-progress">
          <span
            className={
              step >= 1
                ? 'active'
                : ''
            }
          >
            01
            <b>
              Equipment details
            </b>
          </span>

          <span
            className={
              step >= 2
                ? 'active'
                : ''
            }
          >
            02
            <b>
              Description & photos
            </b>
          </span>

          <span
            className={
              step >= 3
                ? 'active'
                : ''
            }
          >
            03
            <b>
              Review & submit
            </b>
          </span>
        </div>

        <form
          className="sell-form"
          onSubmit={e => {
            e.preventDefault()
            step < 3
              ? setStep(step + 1)
              : submit(e)
          }}
        >
          {step === 1 && (
            <>
              <FormIntro
                title="Tell us about the equipment"
                text="The essentials help buyers find the right match."
              />

              <div className="field-grid">
                {[
                  [
                    'name',
                    'Equipment name',
                    'e.g. CNC Vertical Machining Center',
                  ],
                  [
                    'brand',
                    'Brand',
                    'e.g. Haas',
                  ],
                  [
                    'model',
                    'Model',
                    'e.g. VF-2',
                  ],
                  [
                    'year',
                    'Manufacturing year',
                    'e.g. 2021',
                  ],
                  [
                    'condition',
                    'Condition',
                    'Select condition',
                  ],
                  [
                    'price',
                    'Expected price',
                    '₹ Enter amount',
                  ],
                  [
                    'location',
                    'Location',
                    'City, State',
                  ],
                ].map(
                  ([
                    name,
                    label,
                    placeholder,
                  ]) => (
                    <label key={name}>
                      {label}

                      <input
                        name={name}
                        value={form[name]}
                        onChange={update}
                        placeholder={
                          placeholder
                        }
                      />
                    </label>
                  )
                )}

                <label>
                  Category

                  <select
                    name="category"
                    value={form.category}
                    onChange={update}
                  >
                    <option value="">
                      Select a category
                    </option>

                    {categories.map(
                      item => (
                        <option
                          key={item.name}
                        >
                          {item.name}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <FormIntro
                title="Add context buyers can trust"
                text="Clear details and real images create confident enquiries."
              />

              <label className="full-field">
                Describe your equipment

                <textarea
                  name="description"
                  value={
                    form.description
                  }
                  onChange={update}
                  placeholder="Share condition, usage history, maintenance and important specifications..."
                />
              </label>

              <div className="upload-zone">
                <Upload size={26} />

                <strong>
                  Drop photos here or browse
                </strong>

                <span>
                  PNG, JPG up to 10MB each ·
                  Add up to 8 images
                </span>

                <button
                  type="button"
                  className="button button-outline"
                  onClick={() =>
                    notify(
                      'Image picker ready for upload integration'
                    )
                  }
                >
                  Choose images
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <FormIntro
                title="Review your submission"
                text="Your listing will stay private until our team approves it."
              />

              <div className="review-card">
                <div>
                  <span className="card-kicker">
                    Equipment
                  </span>

                  <h3>
                    {form.name ||
                      'Your equipment name'}
                  </h3>

                  <p>
                    {form.category ||
                      'Category'}{' '}
                    ·{' '}
                    {form.brand ||
                      'Brand'}{' '}
                    {form.model}
                  </p>
                </div>

                <strong>
                  {form.price ||
                    '₹ Price on request'}
                </strong>
              </div>

              <div className="review-note">
                <ShieldCheck size={19} />

                <span>
                  Your mobile number
                  will be used for secure buyer
                  enquiries. We never publish
                  personal contact details.
                </span>
              </div>
            </>
          )}

          <div className="form-actions">

            {step > 1 && (
              <button
                type="button"
                className="button button-ghost"
                onClick={() =>
                  setStep(step - 1)
                }
              >
                Back
              </button>
            )}

            <button
              className="button button-dark"
              type="submit"
            >
              {step === 3
                ? 'Submit for verification'
                : 'Continue'}

              <ArrowRight size={17} />
            </button>

          </div>
        </form>
      </div>
    </main>
  )
}

function LegacyAdmin({
  notify,
}) {
  const [status, setStatus] =
    useState(
      'Pending Verification'
    )

  return (
    <main className="container page">
      <div className="admin-heading">

        <div>
          <span className="eyebrow">
            Private workspace
          </span>

          <h1>
            Verification desk
          </h1>

          <p>
            Review submissions before they
            become visible to buyers.
          </p>
        </div>

        <span className="admin-chip">
          <ShieldCheck size={15} />
          Middleman access
        </span>
      </div>

      <div className="metric-grid">
        <Metric
          label="Total listings"
          value="312"
          trend="+12 this month"
        />

        <Metric
          label="Pending review"
          value="08"
          trend="Needs attention"
          warn
        />

        <Metric
          label="Published"
          value="276"
          trend="88% approval rate"
        />

        <Metric
          label="New enquiries"
          value="24"
          trend="+8 today"
        />
      </div>

      <div className="admin-table-wrap">

        <div className="table-head">
          <h2>
            Seller requests
          </h2>

          <div className="table-tabs">
            <button className="active">
              All requests
            </button>

            <button>
              Pending
            </button>

            <button>
              Approved
            </button>
          </div>
        </div>

        <table>

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

              <th />
            </tr>
          </thead>

          <tbody>
            {equipment.map(
              (item, index) => (
                <tr key={item.id}>

                  <td>
                    <div className="table-equipment">

                      <img
                        src={item.image}
                        alt=""
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
                  </td>

                  <td>
                    Arjun Mehta
                    <br />
                    <small>
                      +91 98••• 3210
                    </small>
                  </td>

                  <td>
                    {item.price}
                  </td>

                  <td>
                    {index + 1} day
                    {index ? 's' : ''} ago
                  </td>

                  <td>
                    <button
                      className={`status-pill ${index === 0
                        ? 'pending'
                        : 'approved'
                        }`}
                      onClick={() =>
                        setStatus(
                          index === 0
                            ? 'Under Review'
                            : 'Approved'
                        )
                      }
                    >
                      {index === 0
                        ? status
                        : 'Approved'}
                    </button>
                  </td>

                  <td>
                    <button
                      className="more-button"
                      onClick={() =>
                        notify(
                          'Opening submission details'
                        )
                      }
                    >
                      •••
                    </button>
                  </td>

                </tr>
              )
            )}
          </tbody>

        </table>
      </div>
    </main>
  )
}

function EquipmentCard({
  item,
  onClick,
}) {
  return (
    <article className="equipment-card">

      <button
        className="heart"
        aria-label="Save listing"
      >
        <Heart size={17} />
      </button>

      <button
        className="equipment-image"
        onClick={onClick}
      >
        <img
          src={
            item.image ||
            item.images?.[0] ||
            ''
          }
          alt={item.name}
        />

        <span className="listing-tag">
          <BadgeCheck size={13} />
          {item.tag ||
            'Verified Equipment'}
        </span>
      </button>

      <div className="equipment-body">

        <div className="listing-meta">
          <span>
            {item.category}
          </span>

          <span>
            {item.year}
          </span>
        </div>

        <h3>
          {item.name}
        </h3>

        <p>
          {item.brand} · {item.model} ·{' '}
          {item.condition}
        </p>

        <div className="equipment-footer">

          <strong>
            {item.price}
          </strong>

          <span>
            <Building2 size={14} />
            {item.location?.split(',')[0]}
          </span>

        </div>

      </div>
    </article>
  )
}

function Details({
  item,
  close,
  notify,
}) {
  return (
    <div className="modal-backdrop detail-backdrop">

      <div className="detail-modal">

        <button
          className="modal-close"
          onClick={close}
        >
          <X size={18} />
        </button>

        <div className="detail-image">

          {item.images?.[0] ? (
            <img
              src={item.images[0]}
              alt={item.name}
            />
          ) : (
            <span className="equipment-image-empty">
              No image provided
            </span>
          )}

          <span>
            <BadgeCheck size={14} />
            Verified Equipment
          </span>

        </div>

        <div className="detail-copy">

          <span className="eyebrow">
            {item.category}
          </span>

          <h2>
            {item.name}
          </h2>

          <p className="detail-price">
            {item.price
              ? `₹${Number(
                item.price
              ).toLocaleString('en-IN')}`
              : 'Price on request'}
          </p>

          <div className="detail-facts">

            <span>
              <b>Brand</b>
              {item.brand ||
                'Not provided'}
            </span>

            <span>
              <b>Model</b>
              {item.model ||
                'Not provided'}
            </span>

            <span>
              <b>Year</b>
              {item.year ||
                'Not provided'}
            </span>

            <span>
              <b>Condition</b>
              {item.condition ||
                'Not provided'}
            </span>

            <span>
              <b>Location</b>
              {item.location ||
                'Not provided'}
            </span>

          </div>

          <div className="detail-note">
            <ShieldCheck size={18} />

            <span>
              <strong>
                Reviewed by EquipTrade team
              </strong>{' '}
              Photos and listing details
              have been checked.
            </span>
          </div>

          <button
            className="button button-dark full-button"
            onClick={() =>
              notify(
                'Interest sent securely to the seller'
              )
            }
          >
            I’m interested
            <ArrowRight size={17} />
          </button>

        </div>
      </div>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  link,
  onClick,
}) {
  return (
    <div className="section-heading">

      <div>
        <span className="eyebrow">
          {eyebrow}
        </span>

        <h2>
          {title}
        </h2>
      </div>

      {link && (
        <button
          className="text-link heading-link"
          onClick={onClick}
        >
          {link}
          <ArrowRight size={16} />
        </button>
      )}

    </div>
  )
}

function Process({
  icon,
  number,
  title,
  text,
}) {
  return (
    <div className="process-step">

      <span className="process-number">
        {number}
      </span>

      <div className="process-icon">
        {icon}
      </div>

      <h3>
        {title}
      </h3>

      <p>
        {text}
      </p>

    </div>
  )
}

function FormIntro({
  title,
  text,
}) {
  return (
    <div className="form-intro">
      <h2>
        {title}
      </h2>

      <p>
        {text}
      </p>
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

const rootElement = document.getElementById('root')
const root = import.meta.hot?.data.root || createRoot(rootElement)

if (import.meta.hot) {
  import.meta.hot.dispose(data => {
    data.root = root
  })
}

root.render(<App />)