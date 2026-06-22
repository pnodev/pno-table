import { ChevronDown, ChevronRight, Eye, RefreshCw, Table2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ScrollArea } from '#/components/ui/scroll-area'
import { Button } from '#/components/ui/button'
import { FormAlert } from '#/components/ui/form-layout'
import { SidebarLink } from '#/components/ui/nav-patterns'
import { formatAppError } from '#/lib/format-error'
import { SIDEBAR_REFRESH_EVENT } from '#/lib/sidebar-refresh'
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
  const [databaseErrors, setDatabaseErrors] = useState<Record<string, string>>(
    {},
  )
  const [schemaErrors, setSchemaErrors] = useState<Record<string, string>>({})

  const schemasCacheRef = useRef<SchemaCache>({})
  const relationsCacheRef = useRef<RelationCache>({})
  const autoExpandedDatabaseRef = useRef<string | null>(null)

  const loadSeqRef = useRef(0)

  const load = useCallback(async ({ resetExpansion }: { resetExpansion: boolean }) => {
    const seq = ++loadSeqRef.current
    setLoadingDatabases(true)
    setError(null)
    setDatabaseErrors({})
    setSchemaErrors({})
    schemasCacheRef.current = {}
    relationsCacheRef.current = {}
    autoExpandedDatabaseRef.current = null
    setSchemasByDatabase({})
    setRelationsBySchema({})

    if (resetExpansion) {
      setExpandedDatabases(new Set())
      setExpandedSchemas(new Set())
    }

    try {
      const rows = await fetchDatabases({ data: { connectionId } })
      if (seq !== loadSeqRef.current) {
        return
      }
      setDatabases(rows)
    } catch (loadError) {
      if (seq !== loadSeqRef.current) {
        return
      }
      setError(formatAppError(loadError, 'Failed to load databases'))
    } finally {
      if (seq !== loadSeqRef.current) {
        return
      }
      setLoadingDatabases(false)
    }
  }, [connectionId])

  useEffect(() => {
    void load({ resetExpansion: true }).catch(() => {
      // load() already sets user-friendly error state
    })
  }, [load])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handler = (event: Event) => {
      const detail =
        (event as CustomEvent<{ connectionId?: string }>).detail ?? {}

      if (detail.connectionId && detail.connectionId !== connectionId) {
        return
      }

      void load({ resetExpansion: false })
    }

    window.addEventListener(SIDEBAR_REFRESH_EVENT, handler)
    return () => window.removeEventListener(SIDEBAR_REFRESH_EVENT, handler)
  }, [connectionId, load])

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
      setDatabaseErrors((current) => {
        const next = { ...current }
        delete next[database]
        return next
      })
    } catch (loadError) {
      const message = formatAppError(loadError, 'Failed to load schemas')
      schemasCacheRef.current = {
        ...schemasCacheRef.current,
        [database]: [],
      }
      setSchemasByDatabase((current) => ({ ...current, [database]: [] }))
      setDatabaseErrors((current) => ({ ...current, [database]: message }))
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
      setSchemaErrors((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
    } catch (loadError) {
      const message = formatAppError(loadError, 'Failed to load tables')
      relationsCacheRef.current = {
        ...relationsCacheRef.current,
        [key]: [],
      }
      setRelationsBySchema((current) => ({ ...current, [key]: [] }))
      setSchemaErrors((current) => ({ ...current, [key]: message }))
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

  useEffect(() => {
    if (loadingDatabases || databases.length !== 1) {
      return
    }

    const database = databases[0]?.name
    if (!database || autoExpandedDatabaseRef.current === database) {
      return
    }

    autoExpandedDatabaseRef.current = database
    setExpandedDatabases(new Set([database]))
    void ensureSchemas(database)
  }, [databases, loadingDatabases])

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
    <aside className="flex h-full min-h-0 w-full flex-col bg-sidebar">
      <div className="flex items-center justify-between gap-2 border-b border-sidebar-border bg-muted/50 px-3 py-2.5">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Navigation
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => void load({ resetExpansion: false })}
          aria-label="Refresh sidebar"
          title="Refresh"
        >
          <RefreshCw className="size-3.5" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 p-2">
          {loadingDatabases ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              Loading databases...
            </p>
          ) : null}

          {error ? <FormAlert className="text-xs">{error}</FormAlert> : null}

          {!loadingDatabases && databases.length === 0 && !error ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              No accessible databases for this user.
            </p>
          ) : null}

          {databases.map((database) => {
            const isDatabaseExpanded = expandedDatabases.has(database.name)
            const schemas = schemasByDatabase[database.name] ?? []
            const isDatabaseLoading = loadingSchemas.has(database.name)
            const databaseError = databaseErrors[database.name]

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

                    {databaseError ? (
                      <p className="px-2 py-1 text-xs text-destructive">
                        {databaseError}
                      </p>
                    ) : null}

                    {!isDatabaseLoading &&
                    !databaseError &&
                    schemas.length === 0 ? (
                      <p className="px-2 py-1 text-xs text-muted-foreground">
                        No accessible schemas.
                      </p>
                    ) : null}

                    {schemas.map((schema) => {
                      const schemaKey = cacheKey(database.name, schema.name)
                      const isSchemaExpanded = expandedSchemas.has(schemaKey)
                      const relations = relationsBySchema[schemaKey] ?? []
                      const isRelationsLoading = loadingRelations.has(schemaKey)
                      const schemaError = schemaErrors[schemaKey]
                      const relationsLoaded =
                        relationsCacheRef.current[schemaKey] !== undefined

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

                              {schemaError ? (
                                <p className="px-2 py-1 text-xs text-destructive">
                                  {schemaError}
                                </p>
                              ) : null}

                              {!isRelationsLoading &&
                              !schemaError &&
                              relationsLoaded &&
                              relations.length === 0 ? (
                                <p className="px-2 py-1 text-xs text-muted-foreground">
                                  No accessible tables.
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
