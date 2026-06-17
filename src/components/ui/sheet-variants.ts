import { cva, type VariantProps } from 'class-variance-authority'

export const sheetContentVariants = cva(
  'fixed z-50 flex flex-col bg-background shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-500',
  {
    variants: {
      side: {
        right:
          'inset-y-0 right-0 h-full border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
        left:
          'inset-y-0 left-0 h-full border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
        top:
          'inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
        bottom:
          'inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
      },
      size: {
        sm: 'w-[min(92vw,var(--sheet-width-sm))] max-w-[min(92vw,var(--sheet-width-sm))]',
        md: 'w-[min(92vw,var(--sheet-width-md))] max-w-[min(92vw,var(--sheet-width-md))]',
        lg: 'w-[min(92vw,var(--sheet-width-lg))] max-w-[min(92vw,var(--sheet-width-lg))]',
        wide: 'w-[min(92vw,var(--sheet-width-wide))] max-w-[min(92vw,var(--sheet-width-wide))]',
      },
      padding: {
        default: 'gap-4 p-4',
        none: 'gap-0 p-0',
      },
    },
    defaultVariants: {
      side: 'right',
      size: 'sm',
      padding: 'default',
    },
  },
)

export type SheetContentVariantProps = VariantProps<typeof sheetContentVariants>
