import { zValidator } from '@hono/zod-validator'
import type { ZodMiniType } from 'zod/mini'

// A bad body answers 400 without the zod details.
export const validate = <T extends ZodMiniType>(schema: T) =>
  zValidator('json', schema, (result, c) => {
    if (!result.success) return c.json({ error: 'Invalid request' }, 400)
  })
