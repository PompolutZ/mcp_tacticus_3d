import type { ErrorHandler, NotFoundHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

export const onError: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }
  // Never send the message of an unknown error to the client.
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
}

export const notFound: NotFoundHandler = (c) => c.json({ error: 'Not found' }, 404)
