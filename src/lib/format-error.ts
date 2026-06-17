import { z } from 'zod'

type ZodIssueLike = {
  message?: string
  path?: Array<string | number>
}

function isZodIssueArray(value: unknown): value is ZodIssueLike[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        ('message' in item || 'path' in item),
    )
  )
}

function formatZodIssues(issues: ZodIssueLike[]): string {
  const first = issues[0]

  if (!first?.message) {
    return 'Validation failed'
  }

  const path = first.path?.filter((segment) => segment !== 'values')

  if (path && path.length > 0) {
    const field = path.join('.')
    return `${field}: ${first.message}`
  }

  return first.message
}

function parseJsonErrorMessage(message: string): string | null {
  const trimmed = message.trim()

  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
    return null
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown

    if (z.ZodError && parsed instanceof z.ZodError) {
      return formatZodIssues(parsed.issues)
    }

    if (isZodIssueArray(parsed)) {
      return formatZodIssues(parsed)
    }
  } catch {
    return null
  }

  return null
}

export function formatAppError(
  error: unknown,
  fallback = 'Something went wrong',
): string {
  if (error instanceof z.ZodError) {
    return formatZodIssues(error.issues)
  }

  if (error instanceof AggregateError) {
    for (const nested of error.errors) {
      const message = formatAppError(nested, '')

      if (message) {
        return message
      }
    }
  }

  if (error instanceof Error) {
    if (error.message) {
      return parseJsonErrorMessage(error.message) ?? error.message
    }
  }

  if (typeof error === 'string') {
    return parseJsonErrorMessage(error) ?? error
  }

  return fallback
}
