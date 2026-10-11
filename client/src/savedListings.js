const STORAGE_KEY = 'equiptrade_saved_items'
const SAVED_LISTINGS_EVENT = 'equiptrade:saved-listings-changed'

export function isListingSaved(id) {
  if (!id) return false

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(saved) && saved.includes(String(id))
  } catch (error) {
    console.error('Unable to read saved listings:', error)
    return false
  }
}

export function toggleSavedListing(id) {
  if (!id) {
    throw new Error('This listing cannot be saved because it has no identifier.')
  }

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  if (!Array.isArray(saved)) {
    throw new Error('Saved listings data is invalid. Please clear saved listings and try again.')
  }

  const normalizedId = String(id)
  const alreadySaved = saved.includes(normalizedId)
  const nextSaved = alreadySaved
    ? saved.filter(savedId => savedId !== normalizedId)
    : [...saved, normalizedId]

  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSaved))
  window.dispatchEvent(new Event(SAVED_LISTINGS_EVENT))

  return !alreadySaved
}

export const savedListingsChangedEvent = SAVED_LISTINGS_EVENT
