const MAX_IDENTIFIER_LENGTH = 63

export function quoteIdentifier(identifier: string): string {
  if (!identifier) {
    throw new Error('Invalid SQL identifier: empty string')
  }

  if (identifier.includes('\0')) {
    throw new Error(`Invalid SQL identifier: ${identifier}`)
  }

  if (identifier.length > MAX_IDENTIFIER_LENGTH) {
    throw new Error(`Invalid SQL identifier: ${identifier}`)
  }

  return `"${identifier.replaceAll('"', '""')}"`
}

export function quoteQualifiedName(schema: string, name: string): string {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(name)}`
}
