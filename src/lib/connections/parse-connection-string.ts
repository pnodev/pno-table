import type { ConnectionInput } from '#/lib/connections/schemas'

export type ParsedConnectionString = Pick<
  ConnectionInput,
  'host' | 'port' | 'username' | 'password' | 'defaultDatabase' | 'sslMode'
>

export type ParseConnectionStringResult =
  | { ok: true; value: ParsedConnectionString }
  | { ok: false; error: string }

function mapSslMode(
  value: string | null | undefined,
): ParsedConnectionString['sslMode'] {
  const normalized = value?.toLowerCase()

  if (!normalized || normalized === 'prefer') {
    return 'prefer'
  }

  if (normalized === 'disable' || normalized === 'allow') {
    return 'disable'
  }

  return 'require'
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function parseUriConnectionString(
  input: string,
): ParseConnectionStringResult {
  let raw = input.trim()

  if (!/^[a-z+]+:\/\//i.test(raw) && raw.includes('@')) {
    raw = `postgresql://${raw}`
  }

  raw = raw.replace(/^postgres:\/\//i, 'postgresql://')

  let url: URL

  try {
    url = new URL(raw)
  } catch {
    return { ok: false, error: 'Invalid connection URL' }
  }

  if (url.protocol !== 'postgresql:') {
    return { ok: false, error: 'Only postgresql:// URLs are supported' }
  }

  const host = url.hostname

  if (!host) {
    return { ok: false, error: 'Host is missing from connection string' }
  }

  const database = decode(url.pathname.replace(/^\//, '')) || 'postgres'
  const username = decode(url.username) || 'postgres'
  const password = decode(url.password)
  const port = url.port ? Number(url.port) : 5432
  const sslmodeParam = url.searchParams.get('sslmode')
  const sslMode = sslmodeParam
    ? mapSslMode(sslmodeParam)
    : url.searchParams.get('ssl') === 'true'
      ? 'require'
      : 'prefer'

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, error: 'Port must be between 1 and 65535' }
  }

  if (!password) {
    return { ok: false, error: 'Password is missing from connection string' }
  }

  return {
    ok: true,
    value: {
      host,
      port,
      username,
      password,
      defaultDatabase: database,
      sslMode,
    },
  }
}

function parseLibpqConnectionString(
  input: string,
): ParseConnectionStringResult {
  const params: Record<string, string> = {}
  const pattern = /([a-zA-Z_][a-zA-Z0-9_]*)=(('([^']*)')|("([^"]*)")|(\S+))/g

  for (const match of input.matchAll(pattern)) {
    const key = match[1]!.toLowerCase()
    const value = match[4] ?? match[6] ?? match[7] ?? ''
    params[key] = value
  }

  if (Object.keys(params).length === 0) {
    return { ok: false, error: 'No connection parameters found' }
  }

  const host = params.host ?? params.hostname

  if (!host) {
    return { ok: false, error: 'Host is missing from connection string' }
  }

  const port = params.port ? Number(params.port) : 5432
  const username = params.user ?? params.username ?? 'postgres'
  const password = params.password ?? ''
  const database = params.dbname ?? params.database ?? 'postgres'
  const sslMode = mapSslMode(params.sslmode)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, error: 'Port must be between 1 and 65535' }
  }

  if (!password) {
    return { ok: false, error: 'Password is missing from connection string' }
  }

  return {
    ok: true,
    value: {
      host,
      port,
      username,
      password,
      defaultDatabase: database,
      sslMode,
    },
  }
}

export function parseConnectionString(
  input: string,
): ParseConnectionStringResult {
  const trimmed = input.trim()

  if (!trimmed) {
    return { ok: false, error: 'Connection string is empty' }
  }

  if (/^postgres(ql)?:\/\//i.test(trimmed) || /^[^=\s]+@[^=\s]+/.test(trimmed)) {
    return parseUriConnectionString(trimmed)
  }

  if (trimmed.includes('=')) {
    return parseLibpqConnectionString(trimmed)
  }

  return {
    ok: false,
    error:
      'Unrecognized format. Use a postgresql:// URL or libpq key=value string.',
  }
}

export function suggestConnectionName(
  parsed: ParsedConnectionString,
): string {
  if (parsed.defaultDatabase && parsed.defaultDatabase !== 'postgres') {
    return `${parsed.host}/${parsed.defaultDatabase}`
  }

  return parsed.host
}
