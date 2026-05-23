/**
 * Next.js Middleware entry point.
 *
 * All middleware logic lives in proxy.ts. This file exists solely because
 * Next.js requires the middleware file to be named `middleware.ts` at the
 * project root — it will not pick up `proxy.ts` regardless of what it exports.
 */
export { proxy as middleware, config } from "./proxy"
