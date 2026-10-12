export function toProductSlug(name) {
  if (!name) return ''
  return encodeURIComponent(
    String(name)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
  )
}
