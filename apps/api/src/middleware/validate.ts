import { zValidator } from '@hono/zod-validator'
import type { ZodType } from 'zod'

// A bad body answers 400 without the zod details.
export const validate = <T extends ZodType>(schema: T) =>
  zValidator('json', schema, (result, c) => {
    if (!result.success) return c.json({ error: 'Invalid request' }, 400)
  })
