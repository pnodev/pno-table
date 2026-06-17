import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { formatAppError } from '#/lib/format-error'

describe('formatAppError', () => {
  it('formats ZodError instances', () => {
    const schema = z.object({
      values: z.object({
        name: z.string().regex(/^[a-z_]+$/, 'Use lowercase letters and underscores only'),
      }),
    })

    const result = schema.safeParse({ values: { name: 'Another Test' } })

    if (result.success) {
      throw new Error('expected validation failure')
    }

    expect(formatAppError(result.error)).toBe(
      'name: Use lowercase letters and underscores only',
    )
  })

  it('parses JSON-encoded Zod issues from error messages', () => {
    const message = JSON.stringify([
      {
        origin: 'string',
        code: 'invalid_format',
        format: 'regex',
        pattern: '/^[a-zA-Z_][a-zA-Z0-9_$]*$/',
        path: ['values', 'name'],
        message:
          'Invalid string: must match pattern /^[a-zA-Z_][a-zA-Z0-9_$]*$/',
      },
    ])

    expect(formatAppError(new Error(message))).toBe(
      'name: Invalid string: must match pattern /^[a-zA-Z_][a-zA-Z0-9_$]*$/',
    )
  })

  it('falls back to a generic message', () => {
    expect(formatAppError({})).toBe('Something went wrong')
  })
})
