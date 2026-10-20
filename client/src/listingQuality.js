const CLOUDINARY_IMAGE_PATTERN = /^https:\/\/res\.cloudinary\.com\/[^/\s]+\/image\/upload\/.+/

export function isPublicQualityListing(item) {
  return (
    item &&
    ['approved', 'published'].includes(item.status) &&
    item.isActive !== false &&
    item.isQualityHold !== true &&
    typeof item.name === 'string' &&
    Boolean(item.name.trim()) &&
    typeof item.category === 'string' &&
    Boolean(item.category.trim()) &&
    CLOUDINARY_IMAGE_PATTERN.test(item.images?.[0] || '')
  )
}
