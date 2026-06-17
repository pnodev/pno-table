import { describe, expect, it } from 'vitest'

import { parseCellUrl, isImageUrl, shouldPreviewAsImage } from '#/lib/url/detect-url'

describe('parseCellUrl', () => {
  it('accepts http and https URLs', () => {
    expect(parseCellUrl('https://example.com/docs')).toBe('https://example.com/docs')
    expect(parseCellUrl('http://localhost:3000/')).toBe('http://localhost:3000/')
  })

  it('normalizes www URLs', () => {
    expect(parseCellUrl('www.example.com/page')).toBe('https://www.example.com/page')
  })

  it('rejects non-url values', () => {
    expect(parseCellUrl(null)).toBeNull()
    expect(parseCellUrl('01986189-cb12-7890-abcd-ef1234567890')).toBeNull()
    expect(parseCellUrl('just some text')).toBeNull()
    expect(parseCellUrl('javascript:alert(1)')).toBeNull()
  })
})

describe('isImageUrl', () => {
  it('detects common image extensions', () => {
    expect(isImageUrl('https://cdn.example.com/photo.jpg')).toBe(true)
    expect(isImageUrl('https://cdn.example.com/photo.JPEG?v=2')).toBe(true)
    expect(isImageUrl('https://cdn.example.com/file')).toBe(false)
  })

  it('treats extensionless URLs as image candidates via preview helper', () => {
    expect(shouldPreviewAsImage('https://q3lim8tcbz.ufs.sh/f/abc123')).toBe(false)
  })
})
