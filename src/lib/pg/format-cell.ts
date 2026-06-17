import { formatForeignKeyOptionValue } from '#/lib/pg/foreign-keys'

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL'
  }

  if (typeof value === 'object') {
    if (value instanceof Date) {
      return value.toISOString()
    }

    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }

  return String(value)
}

export function totalPages(totalRows: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalRows / pageSize))
}

export function formatRelationCellValue(
  rawValue: unknown,
  labels: Record<string, string> | undefined,
): { display: string; title: string } {
  const raw = formatCellValue(rawValue)

  if (rawValue === null || rawValue === undefined) {
    return { display: raw, title: raw }
  }

  const key = formatForeignKeyOptionValue(rawValue)
  const label = labels?.[key]

  if (!label || label === key) {
    return { display: raw, title: raw }
  }

  return {
    display: label,
    title: `${label} · ${raw}`,
  }
}
