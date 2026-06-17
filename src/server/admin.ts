import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  createDatabaseSchema,
  createRoleSchema,
  dropDatabaseSchema,
  dropRoleSchema,
  saveRoleDatabaseAccessSchema,
  updateRoleSchema,
} from '#/lib/pg/admin-schemas'
import {
  applyDatabaseAccessChange,
  createDatabase,
  createRole,
  dropDatabase,
  dropRole,
  listDatabaseDetails,
  listRoleDatabaseAccess,
  listRoleNames,
  listRoles,
  revokePublicDatabaseConnect,
  updateRole,
} from '#/lib/pg/admin'
import { withPgClient, resolveConnection } from '#/lib/pg/resolve-connection'

const connectionIdSchema = z.object({
  connectionId: z.string().uuid(),
})

const roleNameSchema = connectionIdSchema.extend({
  role: z.string().min(1),
})

function assertWritable(readOnly: boolean) {
  if (readOnly) {
    throw new Error('This connection is read-only')
  }
}

export const fetchDatabaseDetails = createServerFn({ method: 'GET' })
  .validator((data) => connectionIdSchema.parse(data))
  .handler(async ({ data }) => {
    const resolved = await resolveConnection(data.connectionId)

    return withPgClient(
      data.connectionId,
      resolved.profile.defaultDatabase,
      async (client) => listDatabaseDetails(client),
    )
  })

export const fetchRoles = createServerFn({ method: 'GET' })
  .validator((data) => connectionIdSchema.parse(data))
  .handler(async ({ data }) => {
    const resolved = await resolveConnection(data.connectionId)

    return withPgClient(
      data.connectionId,
      resolved.profile.defaultDatabase,
      async (client) => listRoles(client),
    )
  })

export const fetchRoleNames = createServerFn({ method: 'GET' })
  .validator((data) => connectionIdSchema.parse(data))
  .handler(async ({ data }) => {
    const resolved = await resolveConnection(data.connectionId)

    return withPgClient(
      data.connectionId,
      resolved.profile.defaultDatabase,
      async (client) => listRoleNames(client),
    )
  })

export const createServerDatabase = createServerFn({ method: 'POST' })
  .validator((data) =>
    connectionIdSchema.extend({ values: createDatabaseSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    return withPgClient(
      data.connectionId,
      (await resolveConnection(data.connectionId)).profile.defaultDatabase,
      async (client, resolved) => {
        assertWritable(resolved.profile.readOnly)
        await createDatabase(client, data.values)
        return { success: true as const }
      },
    )
  })

export const removeServerDatabase = createServerFn({ method: 'POST' })
  .validator((data) =>
    connectionIdSchema.extend({ values: dropDatabaseSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    return withPgClient(
      data.connectionId,
      (await resolveConnection(data.connectionId)).profile.defaultDatabase,
      async (client, resolved) => {
        assertWritable(resolved.profile.readOnly)
        await dropDatabase(client, data.values.name)
        return { success: true as const }
      },
    )
  })

export const createServerRole = createServerFn({ method: 'POST' })
  .validator((data) =>
    connectionIdSchema.extend({ values: createRoleSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    return withPgClient(
      data.connectionId,
      (await resolveConnection(data.connectionId)).profile.defaultDatabase,
      async (client, resolved) => {
        assertWritable(resolved.profile.readOnly)
        await createRole(client, data.values.name, data.values)
        return { success: true as const }
      },
    )
  })

export const updateServerRole = createServerFn({ method: 'POST' })
  .validator((data) =>
    connectionIdSchema.extend({ values: updateRoleSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    return withPgClient(
      data.connectionId,
      (await resolveConnection(data.connectionId)).profile.defaultDatabase,
      async (client, resolved) => {
        assertWritable(resolved.profile.readOnly)
        await updateRole(client, data.values.name, data.values)
        return { success: true as const }
      },
    )
  })

export const removeServerRole = createServerFn({ method: 'POST' })
  .validator((data) =>
    connectionIdSchema.extend({ values: dropRoleSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    return withPgClient(
      data.connectionId,
      (await resolveConnection(data.connectionId)).profile.defaultDatabase,
      async (client, resolved) => {
        assertWritable(resolved.profile.readOnly)
        await dropRole(client, data.values.name)
        return { success: true as const }
      },
    )
  })

export const fetchRoleDatabaseAccess = createServerFn({ method: 'GET' })
  .validator((data) => roleNameSchema.parse(data))
  .handler(async ({ data }) => {
    const resolved = await resolveConnection(data.connectionId)

    return withPgClient(
      data.connectionId,
      resolved.profile.defaultDatabase,
      async (client) => listRoleDatabaseAccess(client, data.role),
    )
  })

export const saveServerRoleDatabaseAccess = createServerFn({ method: 'POST' })
  .validator((data) =>
    connectionIdSchema.extend({ values: saveRoleDatabaseAccessSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const resolved = await resolveConnection(data.connectionId)
    assertWritable(resolved.profile.readOnly)

    const previous = await withPgClient(
      data.connectionId,
      resolved.profile.defaultDatabase,
      async (client) => listRoleDatabaseAccess(client, data.values.role),
      { allowFallback: true },
    )

    const previousByDatabase = new Map(
      previous.map((entry) => [entry.database, entry]),
    )

    for (const entry of data.values.databases) {
      const prior = previousByDatabase.get(entry.database)

      if (!prior) {
        continue
      }

      const targetCreate = entry.canConnect && entry.canCreate
      const shouldApply =
        entry.canConnect !== prior.canConnect ||
        targetCreate !== prior.canCreate ||
        entry.canConnect

      if (!shouldApply) {
        continue
      }

      await withPgClient(data.connectionId, entry.database, async (client) => {
        await applyDatabaseAccessChange(
          client,
          entry.database,
          data.values.role,
          entry,
          prior,
        )
      })
    }

    return { success: true as const }
  })

export const revokePublicDatabaseAccess = createServerFn({ method: 'POST' })
  .validator((data) =>
    connectionIdSchema
      .extend({ database: z.string().min(1) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    return withPgClient(
      data.connectionId,
      (await resolveConnection(data.connectionId)).profile.defaultDatabase,
      async (client, resolved) => {
        assertWritable(resolved.profile.readOnly)
        await revokePublicDatabaseConnect(client, data.database)
        return { success: true as const }
      },
    )
  })
