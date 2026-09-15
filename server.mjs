// Custom dev/prod server.
//
// Why this exists: Next 16's webpack hot-reloader creates its HMR WebSocket
// server with only `{ noServer: true }` and never sets `maxPayload` or an
// `error` handler on the accepted sockets (see
// node_modules/next/dist/server/dev/hot-reloader-webpack.js). The `ws` library
// then applies its default 100MB `maxPayload`, and when a frame exceeds it (or
// a malformed oversized frame arrives) `ws` throws
//   RangeError: Max payload size exceeded  (WS_ERR_UNSUPPORTED_MESSAGE_LENGTH)
// Because nothing listens for `error` on that socket, it surfaces as an
// `uncaughtException` and crashes/spams the dev server.
//
// Editing node_modules isn't durable (wiped on install), so we own the HTTP
// server here and:
//   1. Attach an `error` handler to every upgraded socket so a bad frame is
//      dropped and the socket destroyed instead of taking down the process.
//   2. Keep a narrow process-level guard for the specific ws error code as a
//      belt-and-suspenders safeguard.
//
// `webpack: true` keeps dev on the same bundler as `next build --webpack`.

import { createServer } from "node:http"
import next from "next"

const port = parseInt(process.env.PORT || "3000", 10)
const hostname = process.env.HOSTNAME || "0.0.0.0"
const dev = process.env.NODE_ENV !== "production"

// The ws payload-overflow error surfaces on the HMR socket in dev. It's not
// fatal — the socket is already being torn down — so swallow only this exact
// code and let every other uncaught error crash as normal.
process.on("uncaughtException", (err) => {
  if (err && err.code === "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH") {
    console.warn(
      "[server] dropped oversized HMR websocket frame (WS_ERR_UNSUPPORTED_MESSAGE_LENGTH)"
    )
    return
  }
  throw err
})

const app = next({ dev, hostname, port, webpack: dev })

app.prepare().then(() => {
  const handle = app.getRequestHandler()
  const upgradeHandler = app.getUpgradeHandler()

  const server = createServer((req, res) => {
    handle(req, res)
  })

  server.on("upgrade", (req, socket, head) => {
    // Guard the raw socket so a payload-overflow (or any socket-level error)
    // during the HMR handshake/stream is contained instead of crashing Node.
    socket.on("error", (err) => {
      if (err && err.code === "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH") {
        console.warn("[server] HMR socket sent an oversized frame; dropping it")
      } else {
        console.warn("[server] HMR socket error:", err?.message ?? err)
      }
      socket.destroy()
    })

    upgradeHandler(req, socket, head)
  })

  server.listen(port, hostname, () => {
    console.log(
      `> Server listening at http://${hostname}:${port} as ${dev ? "development" : process.env.NODE_ENV}`
    )
  })
})
