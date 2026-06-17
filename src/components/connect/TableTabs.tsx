import { Link } from '@tanstack/react-router'

type TableTabsProps = {
  connectionId: string
  database: string
  schema: string
  table: string
  active: 'browse' | 'structure'
}

export function TableTabs({
  connectionId,
  database,
  schema,
  table,
  active,
}: TableTabsProps) {
  const tabClass = (isActive: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium no-underline transition-colors ${
      isActive
        ? 'bg-brand-subtle text-brand shadow-sm ring-1 ring-brand/25'
        : 'text-muted-foreground hover:bg-brand-subtle/60 hover:text-brand'
    }`

  return (
    <div className="border-b border-border bg-muted/40 px-4 py-2.5">
      <div className="inline-flex gap-1 rounded-lg border border-border bg-muted/60 p-1">
        <Link
          to="/connect/$connectionId/$database/$schema/$table"
          params={{ connectionId, database, schema, table }}
          className={tabClass(active === 'browse')}
        >
          Browse
        </Link>
        <Link
          to="/connect/$connectionId/$database/$schema/$table/structure"
          params={{ connectionId, database, schema, table }}
          className={tabClass(active === 'structure')}
        >
          Structure
        </Link>
      </div>
    </div>
  )
}
