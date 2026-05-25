// Next.js requires the middleware entry point to be named exactly
// "middleware.ts". All logic lives in proxy.ts to keep this file minimal.
export { proxy as middleware, config } from "./proxy"
