const listingCache = new Map()
const productCache = new Map()
const CACHE_LIMIT = 30

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
  return readCache(listingCache, key)
}

export function setCachedListings(key, listings) {
  writeCache(listingCache, key, listings)
}

export function getCachedProduct(slug) {
  return readCache(productCache, slug)
}

export function setCachedProduct(slug, product) {
  writeCache(productCache, slug, product)
}
