import {
  SegmentTab,
  SegmentTabs,
  SegmentTabsBar,
} from '#/components/ui/nav-patterns'

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
  return (
    <SegmentTabsBar>
      <SegmentTabs>
        <SegmentTab
          to="/connect/$connectionId/$database/$schema/$table"
          params={{ connectionId, database, schema, table }}
          active={active === 'browse'}
        >
          Browse
        </SegmentTab>
        <SegmentTab
          to="/connect/$connectionId/$database/$schema/$table/structure"
          params={{ connectionId, database, schema, table }}
          active={active === 'structure'}
        >
          Structure
        </SegmentTab>
      </SegmentTabs>
    </SegmentTabsBar>
  )
}
