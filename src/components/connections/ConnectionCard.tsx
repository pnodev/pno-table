import { Link, useRouter } from '@tanstack/react-router'
import {
  Database,
  LoaderCircle,
  Pencil,
  PlugZap,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'

import { CopyConnectionStringButton } from '#/components/connections/CopyConnectionStringButton'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { FormAlert } from '#/components/ui/form-layout'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import type { ConnectionProfile } from '#/lib/connections/types'
import {
  deleteConnection,
  testSavedConnection,
} from '#/server/connections'

type ConnectionCardProps = {
  connection: ConnectionProfile
}

export function ConnectionCard({ connection }: ConnectionCardProps) {
  const router = useRouter()
  const [testing, setTesting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleTest = async () => {
    setTesting(true)
    setMessage(null)
    setError(null)

    try {
      const result = await testSavedConnection({ data: { id: connection.id } })

      if (result.ok) {
        setMessage(
          `Connected to ${result.database} (${result.latencyMs}ms)`,
        )
      } else {
        setError(result.error || 'Connection test failed')
      }
    } catch (testError) {
      setError(
        testError instanceof Error
          ? testError.message || 'Failed to test connection'
          : 'Failed to test connection',
      )
    } finally {
      setTesting(false)
    }
  }

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete connection "${connection.name}"? This cannot be undone.`,
    )

    if (!confirmed) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      await deleteConnection({ data: { id: connection.id } })
      await router.invalidate()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete connection',
      )
      setDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="size-4 text-brand" />
              {connection.name}
            </CardTitle>
            <CardDescription className="font-mono text-xs sm:text-sm">
              {connection.username}@{connection.host}:{connection.port}/
              {connection.defaultDatabase}
            </CardDescription>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {connection.readOnly ? (
              <Badge variant="secondary">Read-only</Badge>
            ) : null}
            <Badge variant="outline">SSL: {connection.sslMode}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {message ? (
          <FormAlert variant="success">{message}</FormAlert>
        ) : null}
        {error ? <FormAlert>{error}</FormAlert> : null}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/connect/$connectionId" params={{ connectionId: connection.id }}>
            <PlugZap className="size-4" />
            Connect
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleTest}
          disabled={testing || deleting}
        >
          {testing ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <PlugZap className="size-4" />
          )}
          Test
        </Button>
        <Button asChild variant="outline">
          <Link
            to="/connections/$connectionId/edit"
            params={{ connectionId: connection.id }}
          >
            <Pencil className="size-4" />
            Edit
          </Link>
        </Button>
        <CopyConnectionStringButton
          connectionId={connection.id}
          variant="outline"
          size="sm"
          showLabel
        />
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={deleting || testing}
        >
          {deleting ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          Delete
        </Button>
      </CardFooter>
    </Card>
  )
}
