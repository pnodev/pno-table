import { useEffect, useRef, useState } from 'react'

import { Badge } from '#/components/ui/badge'
import { FieldHint, FormAlert } from '#/components/ui/form-layout'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import type { RoleDatabaseAccess } from '#/lib/pg/catalog-types'
import { formatAppError } from '#/lib/format-error'
import { fetchRoleDatabaseAccess } from '#/server/admin'

type RoleDatabaseAccessSectionProps = {
  connectionId: string
  roleName: string
  readOnly: boolean
  isSuperuser: boolean
  value: RoleDatabaseAccess[]
  onChange: (value: RoleDatabaseAccess[]) => void
  onLoaded: () => void
}

function DatabasePrivilegeToggle({
  id,
  label,
  checked,
  disabled = false,
  onCheckedChange,
}: {
  id: string
  label: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-card px-3 py-2">
      <Label htmlFor={id} className="text-sm font-normal">
        {label}
      </Label>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
}

export function RoleDatabaseAccessSection({
  connectionId,
  roleName,
  readOnly,
  isSuperuser,
  value,
  onChange,
  onLoaded,
}: RoleDatabaseAccessSectionProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    loadedRef.current = false
  }, [connectionId, roleName])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const rows = await fetchRoleDatabaseAccess({
          data: { connectionId, role: roleName },
        })

        if (!cancelled) {
          onChange(rows)
          if (!loadedRef.current) {
            onLoaded()
            loadedRef.current = true
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            formatAppError(loadError, 'Failed to load database access'),
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [connectionId, roleName, onChange, onLoaded])

  const updateEntry = (
    database: string,
    patch: Partial<Pick<RoleDatabaseAccess, 'canConnect' | 'canCreate'>>,
  ) => {
    onChange(
      value.map((entry) => {
        if (entry.database !== database) {
          return entry
        }

        const nextConnect = patch.canConnect ?? entry.canConnect
        const nextCreate =
          patch.canCreate ?? (nextConnect ? entry.canCreate : false)

        return {
          ...entry,
          canConnect: nextConnect,
          canCreate: nextConnect ? nextCreate : false,
        }
      }),
    )
  }

  if (isSuperuser) {
    return (
      <FormAlert variant="warning">
        Superusers can access every database. Database grants do not apply.
      </FormAlert>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Database access</p>
        <FieldHint>
          Turn on connect for each database this role should use. Enabling
          connect revokes PUBLIC on that database, grants read access to its
          tables, and is required for the sidebar to show it.
        </FieldHint>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading databases...</p>
      ) : null}

      {error ? <FormAlert>{error}</FormAlert> : null}

      {!loading && value.length === 0 ? (
        <p className="text-sm text-muted-foreground">No databases found.</p>
      ) : null}

      {!loading && value.length > 0 ? (
        <div className="space-y-2">
          {value.map((entry) => {
            const connectId = `db-connect-${entry.database}`
            const createId = `db-create-${entry.database}`

            return (
              <div
                key={entry.database}
                className="space-y-3 rounded-lg border border-border bg-muted/20 p-3"
              >
                <p className="font-mono text-sm font-medium text-foreground">
                  {entry.database}
                </p>

                <div className="grid gap-2 sm:grid-cols-2">
                  <DatabasePrivilegeToggle
                    id={connectId}
                    label="Can connect"
                    checked={entry.canConnect}
                    disabled={readOnly}
                    onCheckedChange={(checked) =>
                      updateEntry(entry.database, { canConnect: checked })
                    }
                  />
                  <DatabasePrivilegeToggle
                    id={createId}
                    label="Can create objects"
                    checked={entry.canCreate}
                    disabled={readOnly || !entry.canConnect}
                    onCheckedChange={(checked) =>
                      updateEntry(entry.database, { canCreate: checked })
                    }
                  />
                </div>

                {entry.publicCanConnect && !entry.canConnect ? (
                  <div className="border-t border-border pt-3">
                    <FieldHint>
                      PUBLIC can connect here. Turn on connect above to give
                      this role dedicated access instead.
                    </FieldHint>
                  </div>
                ) : null}

                {entry.publicCanConnect && entry.canConnect ? (
                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <Badge variant="secondary" className="text-[11px]">
                      PUBLIC connect removed
                    </Badge>
                  </div>
                ) : null}

                {entry.effectiveCanConnect &&
                !entry.canConnect &&
                !entry.publicCanConnect ? (
                  <FieldHint>
                    This role can still connect through inherited privileges.
                  </FieldHint>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
