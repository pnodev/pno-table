import { Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { RoleFormSheet } from '#/components/admin/RoleFormSheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { FormAlert } from '#/components/ui/form-layout'
import type { RoleInfo } from '#/lib/pg/catalog-types'
import { formatAppError } from '#/lib/format-error'
import { fetchRoles, removeServerRole } from '#/server/admin'

type RoleManagerProps = {
  connectionId: string
  readOnly: boolean
  initialRoles: RoleInfo[]
}

function PrivilegeBadge({ enabled, label }: { enabled: boolean; label: string }) {
  if (!enabled) {
    return null
  }

  return (
    <Badge variant="secondary" className="font-mono text-[11px]">
      {label}
    </Badge>
  )
}

export function RoleManager({
  connectionId,
  readOnly,
  initialRoles,
}: RoleManagerProps) {
  const [roles, setRoles] = useState(initialRoles)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingRole, setEditingRole] = useState<RoleInfo | undefined>()
  const [pendingDrop, setPendingDrop] = useState<RoleInfo | null>(null)
  const [dropping, setDropping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    const rows = await fetchRoles({ data: { connectionId } })
    setRoles(rows)
  }

  const openCreate = () => {
    setFormMode('create')
    setEditingRole(undefined)
    setFormOpen(true)
  }

  const openEdit = (role: RoleInfo) => {
    setFormMode('edit')
    setEditingRole(role)
    setFormOpen(true)
  }

  const handleDrop = async () => {
    if (!pendingDrop) {
      return
    }

    setDropping(true)
    setError(null)

    try {
      await removeServerRole({
        data: {
          connectionId,
          values: { name: pendingDrop.name },
        },
      })
      toast.success(`Role "${pendingDrop.name}" dropped`)
      setPendingDrop(null)
      await reload()
    } catch (dropError) {
      setError(formatAppError(dropError, 'Failed to drop role'))
    } finally {
      setDropping(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">
            Users &amp; roles
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage Postgres roles, login privileges, and passwords.
          </p>
        </div>

        {!readOnly ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New role
          </Button>
        ) : null}
      </div>

      {error ? <FormAlert className="mb-4">{error}</FormAlert> : null}

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/70">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Privileges</th>
              <th className="px-3 py-2 text-left font-medium">Member of</th>
              <th className="px-3 py-2 text-right font-medium">Conn. limit</th>
              {!readOnly ? (
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr
                key={role.name}
                className="border-b border-border last:border-0"
              >
                <td className="px-3 py-2 font-mono">{role.name}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <PrivilegeBadge enabled={role.canLogin} label="login" />
                    <PrivilegeBadge enabled={role.isSuperuser} label="superuser" />
                    <PrivilegeBadge enabled={role.canCreateDb} label="createdb" />
                    <PrivilegeBadge
                      enabled={role.canCreateRole}
                      label="createrole"
                    />
                    <PrivilegeBadge
                      enabled={role.isReplication}
                      label="replication"
                    />
                    <PrivilegeBadge enabled={role.bypassRls} label="bypassrls" />
                    {!role.canLogin &&
                    !role.isSuperuser &&
                    !role.canCreateDb &&
                    !role.canCreateRole &&
                    !role.isReplication &&
                    !role.bypassRls ? (
                      <span className="text-muted-foreground">—</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {role.memberOf.length > 0 ? (
                    <span className="font-mono text-xs">
                      {role.memberOf.join(', ')}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {role.connectionLimit < 0 ? '∞' : role.connectionLimit}
                </td>
                {!readOnly ? (
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(role)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setPendingDrop(role)}
                      >
                        Drop
                      </Button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RoleFormSheet
        open={formOpen}
        mode={formMode}
        connectionId={connectionId}
        readOnly={readOnly}
        role={editingRole}
        onOpenChange={setFormOpen}
        onSaved={async () => {
          toast.success(
            formMode === 'create' ? 'Role created' : 'Role updated',
          )
          await reload()
        }}
      />

      <AlertDialog
        open={pendingDrop !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDrop(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop role?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the role{' '}
              <span className="font-mono">{pendingDrop?.name}</span>. Objects
              owned by this role may block deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={dropping}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={dropping}
              onClick={(event) => {
                event.preventDefault()
                void handleDrop()
              }}
            >
              {dropping ? 'Dropping...' : 'Drop role'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
