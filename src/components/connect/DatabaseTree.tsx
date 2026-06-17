import { ChevronDown, ChevronRight, Eye, Table2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { ScrollArea } from '#/components/ui/scroll-area'
import { FormAlert } from '#/components/ui/form-layout'
import { SidebarLink } from '#/components/ui/nav-patterns'
import type {
  DatabaseNode,
  RelationNode,
  SchemaNode,
} from '#/lib/pg/catalog-types'
import {
  fetchDatabases,
  fetchRelations,
  fetchSchemas,
} from '#/server/browse'

type DatabaseTreeProps = {
  connectionId: string
  activeDatabase?: string
  activeSchema?: string
  activeTable?: string
}

type SchemaCache = Record<string, SchemaNode[]>
type RelationCache = Record<string, RelationNode[]>

function cacheKey(database: string, schema?: string) {
  return schema ? `${database}.${schema}` : database
}

export function DatabaseTree({
  connectionId,
  activeDatabase,
  activeSchema,
  activeTable,
}: DatabaseTreeProps) {
  const [databases, setDatabases] = useState<DatabaseNode[]>([])
  const [schemasByDatabase, setSchemasByDatabase] = useState<SchemaCache>({})
  const [relationsBySchema, setRelationsBySchema] = useState<RelationCache>({})
  const [expandedDatabases, setExpandedDatabases] = useState<Set<string>>(
    new Set(),
  )
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set())
  const [loadingDatabases, setLoadingDatabases] = useState(true)
  const [loadingSchemas, setLoadingSchemas] = useState<Set<string>>(new Set())
  const [loadingRelations, setLoadingRelations] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const schemasCacheRef = useRef<SchemaCache>({})
  const relationsCacheRef = useRef<RelationCache>({})

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoadingDatabases(true)
      setError(null)

      try {
        const rows = await fetchDatabases({ data: { connectionId } })
        if (cancelled) return
        setDatabases(rows)
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load databases',
          )
        }
      } finally {
        if (!cancelled) {
          setLoadingDatabases(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [connectionId])

  const ensureSchemas = async (database: string) => {
    if (schemasCacheRef.current[database]) {
      return
    }

    setLoadingSchemas((current) => new Set([...current, database]))

    try {
      const rows = await fetchSchemas({ data: { connectionId, database } })
      schemasCacheRef.current = {
        ...schemasCacheRef.current,
        [database]: rows,
      }
      setSchemasByDatabase((current) => ({ ...current, [database]: rows }))
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load schemas',
      )
    } finally {
      setLoadingSchemas((current) => {
        const next = new Set(current)
        next.delete(database)
        return next
      })
    }
  }

  const ensureRelations = async (database: string, schema: string) => {
    const key = cacheKey(database, schema)

    if (relationsCacheRef.current[key]) {
      return
    }

    setLoadingRelations((current) => new Set([...current, key]))

    try {
      const rows = await fetchRelations({
        data: { connectionId, database, schema },
      })
      relationsCacheRef.current = {
        ...relationsCacheRef.current,
        [key]: rows,
      }
      setRelationsBySchema((current) => ({ ...current, [key]: rows }))
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load tables',
      )
    } finally {
      setLoadingRelations((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }

  useEffect(() => {
    if (!activeDatabase) {
      return
    }

    let cancelled = false

    const hydrateActiveBranch = async () => {
      setExpandedDatabases((current) => new Set([...current, activeDatabase]))

      await ensureSchemas(activeDatabase)
      if (cancelled) {
        return
      }

      if (!activeSchema) {
        return
      }

      const schemaKey = cacheKey(activeDatabase, activeSchema)
      setExpandedSchemas((current) => new Set([...current, schemaKey]))
      await ensureRelations(activeDatabase, activeSchema)
    }

    void hydrateActiveBranch()

    return () => {
      cancelled = true
    }
  }, [connectionId, activeDatabase, activeSchema])

  const toggleDatabase = async (database: string) => {
    const next = new Set(expandedDatabases)

    if (next.has(database)) {
      next.delete(database)
      setExpandedDatabases(next)
      return
    }

    next.add(database)
    setExpandedDatabases(next)
    await ensureSchemas(database)
  }

  const toggleSchema = async (database: string, schema: string) => {
    const key = cacheKey(database, schema)
    const next = new Set(expandedSchemas)

    if (next.has(key)) {
      next.delete(key)
      setExpandedSchemas(next)
      return
    }

    next.add(key)
    setExpandedSchemas(next)
    await ensureRelations(database, schema)
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-sidebar-border bg-sidebar">
      <div className="border-b border-sidebar-border bg-muted/50 px-3 py-2.5">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Navigation
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 p-2">
          {loadingDatabases ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              Loading databases...
            </p>
          ) : null}

          {error ? <FormAlert className="text-xs">{error}</FormAlert> : null}

          {databases.map((database) => {
            const isDatabaseExpanded = expandedDatabases.has(database.name)
            const schemas = schemasByDatabase[database.name] ?? []
            const isDatabaseLoading = loadingSchemas.has(database.name)

            return (
              <div key={database.name}>
                <button
                  type="button"
                  onClick={() => void toggleDatabase(database.name)}
                  className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-sidebar-accent"
                >
                  {isDatabaseExpanded ? (
                    <ChevronDown className="size-3.5 shrink-0" />
                  ) : (
                    <ChevronRight className="size-3.5 shrink-0" />
                  )}
                  <span className="truncate font-medium">{database.name}</span>
                </button>

                {isDatabaseExpanded ? (
                  <div className="ml-4 space-y-1">
                    {isDatabaseLoading ? (
                      <p className="px-2 py-1 text-xs text-muted-foreground">
                        Loading schemas...
                      </p>
                    ) : null}

                    {schemas.map((schema) => {
                      const schemaKey = cacheKey(database.name, schema.name)
                      const isSchemaExpanded = expandedSchemas.has(schemaKey)
                      const relations = relationsBySchema[schemaKey] ?? []
                      const isRelationsLoading = loadingRelations.has(schemaKey)

                      return (
                        <div key={schema.name}>
                          <button
                            type="button"
                            onClick={() =>
                              void toggleSchema(database.name, schema.name)
                            }
                            className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-sidebar-accent"
                          >
                            {isSchemaExpanded ? (
                              <ChevronDown className="size-3.5 shrink-0" />
                            ) : (
                              <ChevronRight className="size-3.5 shrink-0" />
                            )}
                            <span className="truncate">{schema.name}</span>
                          </button>

                          {isSchemaExpanded ? (
                            <div className="ml-4 space-y-0.5">
                              {isRelationsLoading ? (
                                <p className="px-2 py-1 text-xs text-muted-foreground">
                                  Loading tables...
                                </p>
                              ) : null}

                              {relations.map((relation) => {
                                const isActive =
                                  activeDatabase === database.name &&
                                  activeSchema === schema.name &&
                                  activeTable === relation.name

                                return (
                                  <SidebarLink
                                    key={relation.name}
                                    to="/connect/$connectionId/$database/$schema/$table"
                                    params={{
                                      connectionId,
                                      database: database.name,
                                      schema: schema.name,
                                      table: relation.name,
                                    }}
                                    active={isActive}
                                  >
                                    {relation.kind === 'view' ? (
                                      <Eye className="size-3.5 shrink-0" />
                                    ) : (
                                      <Table2 className="size-3.5 shrink-0" />
                                    )}
                                    <span className="truncate">
                                      {relation.name}
                                    </span>
                                  </SidebarLink>
                                )
                              })}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </aside>
  )
}
