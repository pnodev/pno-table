import { Check, Copy, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { formatAppError } from '#/lib/format-error'
import { getConnectionString } from '#/server/connections'

type CopyConnectionStringButtonProps = {
  connectionId: string
  database?: string
  variant?: 'ghost' | 'outline' | 'secondary'
  size?: 'xs' | 'sm' | 'icon-xs' | 'icon-sm'
  showLabel?: boolean
  className?: string
}

export function CopyConnectionStringButton({
  connectionId,
  database,
  variant = 'ghost',
  size = 'icon-xs',
  showLabel = false,
  className,
}: CopyConnectionStringButtonProps) {
  const [copying, setCopying] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    setCopying(true)

    try {
      const connectionString = await getConnectionString({
        data: { connectionId, database },
      })
      await navigator.clipboard.writeText(connectionString)
      toast.success('Connection string copied to clipboard')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch (copyError) {
      toast.error(
        formatAppError(copyError, 'Failed to copy connection string'),
      )
    } finally {
      setCopying(false)
    }
  }

  const icon = copying ? (
    <LoaderCircle className="size-3.5 animate-spin" />
  ) : copied ? (
    <Check className="size-3.5" />
  ) : (
    <Copy className="size-3.5" />
  )

  const title = database
    ? `Copy connection string for ${database}`
    : 'Copy connection string'
  const buttonLabel = database ? 'Copy URL' : 'Copy connection string'

  return (
    <Button
      type="button"
      variant={variant}
      size={showLabel ? 'sm' : size}
      onClick={() => void handleCopy()}
      disabled={copying}
      title={title}
      aria-label={title}
      className={className}
    >
      {icon}
      {showLabel ? buttonLabel : null}
    </Button>
  )
}
