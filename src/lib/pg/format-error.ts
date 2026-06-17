export function formatConnectionError(error: unknown): string {
  if (error instanceof AggregateError) {
    for (const nested of error.errors) {
      if (nested instanceof Error && nested.message) {
        return nested.message
      }
    }

    if (error.code) {
      return String(error.code)
    }
  }

  if (error instanceof Error) {
    if (error.message) {
      return error.message
    }

    if ('code' in error && error.code) {
      return String(error.code)
    }
  }

  return 'Failed to connect to Postgres'
}
