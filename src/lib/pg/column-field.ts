import type { ColumnInfo } from '#/lib/pg/catalog-types'

export type ColumnFieldKind =
  | 'boolean'
  | 'integer'
  | 'number'
  | 'date'
  | 'time'
  | 'datetime'
  | 'json'
  | 'text'
  | 'string'

export function getColumnFieldKind(column: ColumnInfo): ColumnFieldKind {
  const type = column.dataType.toLowerCase()

  if (type === 'boolean') {
    return 'boolean'
  }

  if (
    type === 'smallint' ||
    type === 'integer' ||
    type === 'bigint' ||
    type === 'oid'
  ) {
    return 'integer'
  }

  if (
    type === 'numeric' ||
    type === 'real' ||
    type === 'double precision' ||
    type === 'decimal'
  ) {
    return 'number'
  }

  if (type === 'date') {
    return 'date'
  }

  if (type === 'time without time zone' || type === 'time with time zone') {
    return 'time'
  }

  if (type.includes('timestamp')) {
    return 'datetime'
  }

  if (type === 'json' || type === 'jsonb') {
    return 'json'
  }

  if (type === 'text') {
    return 'text'
  }

  return 'string'
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDatetimeLocal(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
}

function parseDateValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10)
    }

    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10)
    }
  }

  return ''
}

function parseTimeValue(value: unknown): string {
  if (value instanceof Date) {
    return `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  }

  if (typeof value === 'string') {
    const match = value.match(/(\d{2}:\d{2}(?::\d{2})?)/)
    if (match) {
      return match[1].length === 5 ? `${match[1]}:00` : match[1]
    }
  }

  return ''
}

function parseDatetimeValue(value: unknown): string {
  if (value instanceof Date) {
    return formatDatetimeLocal(value)
  }

  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return formatDatetimeLocal(parsed)
    }
  }

  return ''
}

function parseBooleanValue(value: unknown): string {
  if (value === true) {
    return 'true'
  }

  if (value === false) {
    return 'false'
  }

  return ''
}

export function cellValueToFieldValue(
  column: ColumnInfo,
  value: unknown,
): string {
  if (value === null || value === undefined) {
    return ''
  }

  const kind = getColumnFieldKind(column)

  if (kind === 'boolean') {
    return parseBooleanValue(value)
  }

  if (kind === 'date') {
    return parseDateValue(value)
  }

  if (kind === 'time') {
    return parseTimeValue(value)
  }

  if (kind === 'datetime') {
    return parseDatetimeValue(value)
  }

  if (kind === 'json') {
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2)
    }
  }

  if (typeof value === 'object') {
    if (value instanceof Date) {
      return value.toISOString()
    }

    return JSON.stringify(value)
  }

  return String(value)
}

export function isFieldValueNull(value: string) {
  return value.trim() === '' || value.trim().toUpperCase() === 'NULL'
}

export function isExplicitNullValue(value: string) {
  return value.trim().toUpperCase() === 'NULL'
}

export function inputStepForKind(kind: ColumnFieldKind) {
  if (kind === 'integer') {
    return '1'
  }

  if (kind === 'number') {
    return 'any'
  }

  return undefined
}
