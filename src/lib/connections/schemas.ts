import { z } from 'zod'

export const sslModeSchema = z.enum(['disable', 'prefer', 'require'])

export const connectionInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  host: z.string().trim().min(1, 'Host is required'),
  port: z.coerce.number().int().min(1).max(65535).default(5432),
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  defaultDatabase: z.string().trim().min(1).default('postgres'),
  sslMode: sslModeSchema.default('prefer'),
  readOnly: z.boolean().default(false),
})

export const connectionUpdateSchema = connectionInputSchema
  .extend({
    password: z.string().optional(),
  })
  .refine(
    (data) => data.password === undefined || data.password.length > 0,
    'Password cannot be empty when provided',
  )

export type ConnectionInput = z.infer<typeof connectionInputSchema>
export type ConnectionUpdateInput = z.infer<typeof connectionUpdateSchema>
