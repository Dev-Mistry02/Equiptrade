const listingCache = new Map()
const productCache = new Map()
const CACHE_LIMIT = 30
const HOME_CACHE_KEY = 'equiptrade_home_cache_v2'
const HOME_CACHE_TTL_MS = 24 * 60 * 60 * 1000

function isHomeData(value) {
  return (
    value &&
    typeof value === 'object' &&
    Array.isArray(value.listings) &&
    Array.isArray(value.categories) &&
    Number.isFinite(value.totalListings) &&
    value.totalListings >= 0
  )
}

function readCache(cache, key) {
  if (!cache.has(key)) return undefined

  const value = cache.get(key)
  cache.delete(key)
  cache.set(key, value)
  return value
}

function writeCache(cache, key, value) {
  cache.delete(key)
  cache.set(key, value)

  if (cache.size > CACHE_LIMIT) {
    cache.delete(cache.keys().next().value)
  }
}

export function getCachedListings(key = 'all') {
  const cached = readCache(listingCache, key)
  if (cached !== undefined || key !== 'home') return cached

  try {
    const stored = localStorage.getItem(HOME_CACHE_KEY)
    if (!stored) return undefined

    const { data, cachedAt } = JSON.parse(stored)
    const age = Date.now() - cachedAt
    if (
      !isHomeData(data) ||
      !Number.isFinite(cachedAt) ||
      age < 0 ||
      age >= HOME_CACHE_TTL_MS
    ) {
      localStorage.removeItem(HOME_CACHE_KEY)
      return undefined
    }

    writeCache(listingCache, key, data)
    return data
  } catch (error) {
    console.warn('Unable to read cached marketplace listings:', error)
    return undefined
  }
}

export function setCachedListings(key, listings) {
  writeCache(listingCache, key, listings)

  if (key === 'home') {
    try {
      localStorage.setItem(
        HOME_CACHE_KEY,
        JSON.stringify({ data: listings, cachedAt: Date.now() })
      )
    } catch (error) {
      console.warn('Unable to save cached marketplace listings:', error)
    }
  }
}

export function deleteCachedListings(key = 'all') {
  listingCache.delete(key)

  if (key === 'home') {
    try {
      localStorage.removeItem(HOME_CACHE_KEY)
    } catch {
      // ignore
    }
  }
}

export function invalidateAllListings() {
  listingCache.clear()
  try {
    localStorage.removeItem(HOME_CACHE_KEY)
  } catch {
    // ignore
  }
}

export function getCachedProduct(slug) {
  return readCache(productCache, slug)
}

export function setCachedProduct(slug, product) {
  writeCache(productCache, slug, product)
}
