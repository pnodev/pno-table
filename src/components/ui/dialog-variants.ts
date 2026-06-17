import { cva, type VariantProps } from 'class-variance-authority'

export const dialogContentVariants = cva(
  'fixed top-[50%] left-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] rounded-lg border bg-background shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
  {
    variants: {
      size: {
        default:
          'max-w-[calc(100%-2rem)] gap-4 p-6 data-[state=open]:sm:max-w-lg',
        lightbox: 'url-lightbox-content',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

export type DialogContentVariantProps = VariantProps<typeof dialogContentVariants>
