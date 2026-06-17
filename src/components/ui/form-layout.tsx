import * as React from 'react'

import { Label } from '#/components/ui/label'
import { cn } from '#/lib/utils'

function FormGrid({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="form-grid" className={cn('form-grid', className)} {...props} />
}

function FormGridItem({
  className,
  span = 'default',
  ...props
}: React.ComponentProps<'div'> & {
  span?: 'default' | 'wide'
}) {
  return (
    <div
      data-slot="form-grid-item"
      className={cn(span === 'wide' && 'form-grid-item-wide', className)}
      {...props}
    />
  )
}

function Field({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="field" className={cn('field', className)} {...props} />
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return <Label data-slot="field-label" className={cn('field-label', className)} {...props} />
}

function FieldHint({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot="field-hint" className={cn('field-hint', className)} {...props} />
}

function FieldNullToggle({
  checked,
  onCheckedChange,
  className,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
}) {
  return (
    <label className={cn('field-null-toggle', className)}>
      <input
        type="checkbox"
        checked={checked}
        className="field-null-checkbox"
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      NULL
    </label>
  )
}

function FieldGenerateAction({
  onClick,
  disabled,
  className,
}: {
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      className={cn('field-generate-action', className)}
      disabled={disabled}
      onClick={onClick}
    >
      Generate
    </button>
  )
}

function FieldActions({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return <div className={cn('field-actions', className)} {...props} />
}

function NativeSelect({
  className,
  ...props
}: React.ComponentProps<'select'>) {
  return <select data-slot="native-select" className={cn('native-select', className)} {...props} />
}

function FormAlert({
  className,
  variant = 'error',
  ...props
}: React.ComponentProps<'p'> & {
  variant?: 'error' | 'warning' | 'success'
}) {
  return (
    <p
      data-slot="form-alert"
      className={cn(
        'form-alert',
        variant === 'warning' && 'form-alert-warning',
        variant === 'success' && 'form-alert-success',
        className,
      )}
      {...props}
    />
  )
}

export {
  Field,
  FieldActions,
  FieldGenerateAction,
  FieldHint,
  FieldLabel,
  FieldNullToggle,
  FormAlert,
  FormGrid,
  FormGridItem,
  NativeSelect,
}
