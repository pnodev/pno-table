import type { PostgresConnectionConfig } from '#/lib/connections/types'

export type FormatConnectionStringInput = Pick<
  PostgresConnectionConfig,
  'host' | 'port' | 'username' | 'password' | 'sslMode'
> & {
  database: string
}

function formatHost(host: string): string {
  if (host.includes(':') && !host.startsWith('[')) {
    return `[${host}]`
  }

  return host
}

export function formatConnectionString(
  input: FormatConnectionStringInput,
): string {
  const auth = `${encodeURIComponent(input.username)}:${encodeURIComponent(input.password)}`
  const host = formatHost(input.host)
  const portPart = input.port === 5432 ? '' : `:${input.port}`
  const database = encodeURIComponent(input.database)
  return `postgresql://${auth}@${host}${portPart}/${database}?sslmode=${input.sslMode}`
}
