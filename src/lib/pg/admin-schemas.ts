import { z } from 'zod'

const identifierMessage =
  'Use letters, numbers, and underscores only. No spaces.'

export const identifierSchema = z
  .string()
  .min(1, 'Name is required')
  .max(63, 'Name must be 63 characters or fewer')
  .regex(/^[a-zA-Z_][a-zA-Z0-9_$]*$/, identifierMessage)

export const createDatabaseSchema = z.object({
  name: identifierSchema,
  owner: z.string().min(1).optional(),
  encoding: z.string().min(1).default('UTF8'),
  template: z.string().min(1).optional(),
})

export const databaseNameSchema = z.object({
  name: z.string().min(1),
})

export const dropDatabaseSchema = databaseNameSchema

export const createRoleSchema = z.object({
  name: identifierSchema,
  password: z.string().min(1).optional(),
  login: z.boolean().default(true),
  superuser: z.boolean().default(false),
  createdb: z.boolean().default(false),
  createrole: z.boolean().default(false),
  replication: z.boolean().default(false),
  bypassRls: z.boolean().default(false),
  connectionLimit: z.number().int().min(-1).default(-1),
})

export const updateRoleSchema = z.object({
  name: z.string().min(1),
  password: z.string().min(1).optional(),
  login: z.boolean().optional(),
  superuser: z.boolean().optional(),
  createdb: z.boolean().optional(),
  createrole: z.boolean().optional(),
  replication: z.boolean().optional(),
  bypassRls: z.boolean().optional(),
  connectionLimit: z.number().int().min(-1).optional(),
})

export const dropRoleSchema = z.object({
  name: z.string().min(1),
})

export const roleDatabaseAccessEntrySchema = z.object({
  database: z.string().min(1),
  canConnect: z.boolean(),
  canCreate: z.boolean(),
})

export const saveRoleDatabaseAccessSchema = z.object({
  role: z.string().min(1),
  databases: z.array(roleDatabaseAccessEntrySchema),
})
