/**
 * Next.js Middleware entry point.
 *
 * Next.js only recognises middleware exported from a file named `middleware.ts`
 * (or middleware.js) at the project root. The actual implementation lives in
 * proxy.ts so it can be unit-tested independently.
 */
export { proxy as middleware, config } from "./proxy"
