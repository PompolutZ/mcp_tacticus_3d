import type { MiddlewareHandler } from 'hono'

// One line per request, after the response. No query, no headers.
export const log: MiddlewareHandler = async (c, next) => {
  const start = Date.now()
  await next()
  const path = new URL(c.req.url).pathname
  console.log(`${c.req.method} ${path} ${c.res.status} ${Date.now() - start}ms`)
}
