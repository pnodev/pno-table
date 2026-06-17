export function parseCellUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  let candidate = trimmed

  if (/^www\./i.test(candidate)) {
    candidate = `https://${candidate}`
  }

  if (!/^https?:\/\//i.test(candidate)) {
    return null
  }

  try {
    const url = new URL(candidate)

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}

const IMAGE_EXTENSION_PATTERN =
  /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)(\?.*)?$/i

export function isImageUrl(url: string) {
  try {
    const parsed = new URL(url)
    return IMAGE_EXTENSION_PATTERN.test(`${parsed.pathname}${parsed.search}`)
  } catch {
    return false
  }
}

export function shouldPreviewAsImage(url: string) {
  return isImageUrl(url)
}
