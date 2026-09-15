/**
 * Local Upstash-compatible HTTP shim for Redis.
 *
 * WHY: the app talks to Redis through `@upstash/redis`, which uses Upstash's
 * HTTP REST API (POST /pipeline), NOT the normal Redis TCP protocol. A plain
 * local `redis-server` only speaks TCP, so `@upstash/redis` cannot use it
 * directly and the app silently falls back to a slow in-memory cache.
 *
 * This tiny shim bridges the two: it accepts the exact HTTP requests the
 * Upstash client sends and relays each command to a local TCP Redis using the
 * built-in RESP protocol (no dependencies). Point the app at it with:
 *
 *   UPSTASH_REDIS_REST_URL="http://127.0.0.1:8079"
 *   UPSTASH_REDIS_REST_TOKEN="local-dev"   # any non-empty value
 *
 * Run:  node scripts/local-redis-http.mjs
 *
 * This is a LOCAL DEV convenience only. Production uses a real Upstash instance.
 */

import http from "node:http"
import net from "node:net"

const HTTP_PORT = Number(process.env.SHIM_PORT ?? 8079)
const REDIS_HOST = process.env.REDIS_HOST ?? "127.0.0.1"
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379)

// ─── Minimal RESP (Redis serialization protocol) client ──────────────────────

/** Encode a command (array of args) as a RESP array of bulk strings. */
function encodeCommand(args) {
  let out = `*${args.length}\r\n`
  for (const a of args) {
    const s = String(a)
    out += `$${Buffer.byteLength(s)}\r\n${s}\r\n`
  }
  return out
}

/**
 * Parse a single RESP reply from a buffer.
 * Returns { value, rest } or null if more data is needed.
 */
function parseReply(buf) {
  if (buf.length === 0) return null
  const type = String.fromCharCode(buf[0])
  const nl = buf.indexOf("\r\n")
  if (nl === -1) return null
  const line = buf.slice(1, nl).toString()

  switch (type) {
    case "+": // simple string
      return { value: line, rest: buf.slice(nl + 2) }
    case "-": // error
      return { value: { __error: line }, rest: buf.slice(nl + 2) }
    case ":": // integer
      return { value: Number(line), rest: buf.slice(nl + 2) }
    case "$": {
      // bulk string
      const len = Number(line)
      if (len === -1) return { value: null, rest: buf.slice(nl + 2) }
      const start = nl + 2
      if (buf.length < start + len + 2) return null
      const value = buf.slice(start, start + len).toString()
      return { value, rest: buf.slice(start + len + 2) }
    }
    case "*": {
      // array
      const count = Number(line)
      if (count === -1) return { value: null, rest: buf.slice(nl + 2) }
      let rest = buf.slice(nl + 2)
      const arr = []
      for (let i = 0; i < count; i++) {
        const parsed = parseReply(rest)
        if (!parsed) return null
        arr.push(parsed.value)
        rest = parsed.rest
      }
      return { value: arr, rest }
    }
    default:
      return { value: line, rest: buf.slice(nl + 2) }
  }
}

/** Run a batch of commands over a single short-lived TCP connection. */
function runCommands(commands) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(REDIS_PORT, REDIS_HOST)
    let buf = Buffer.alloc(0)
    const replies = []

    sock.on("error", reject)
    sock.on("connect", () => {
      sock.write(commands.map(encodeCommand).join(""))
    })
    sock.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk])
      // Parse as many complete replies as available.
      let parsed
      while ((parsed = parseReply(buf)) !== null) {
        replies.push(parsed.value)
        buf = parsed.rest
        if (replies.length === commands.length) {
          sock.end()
          resolve(replies)
          return
        }
      }
    })
    sock.on("end", () => {
      if (replies.length !== commands.length) {
        resolve(replies) // partial; best-effort
      }
    })
  })
}

// ─── HTTP server matching the Upstash REST contract ──────────────────────────

const server = http.createServer((req, res) => {
  let body = ""
  req.on("data", (c) => (body += c))
  req.on("end", async () => {
    res.setHeader("content-type", "application/json")
    try {
      const url = req.url ?? "/"
      let commands

      if (url === "/pipeline" || url === "/multi-exec") {
        // Body: [["get","k"], ["set","k","v","px",1000], ...]
        commands = JSON.parse(body || "[]")
      } else {
        // Single command REST form: /get/key or JSON body ["get","k"].
        if (body) {
          const parsed = JSON.parse(body)
          commands = Array.isArray(parsed[0]) ? parsed : [parsed]
        } else {
          commands = [url.slice(1).split("/").map(decodeURIComponent)]
        }
      }

      const replies = await runCommands(commands)
      const shaped = replies.map((r) =>
        r && typeof r === "object" && "__error" in r
          ? { error: r.__error }
          : { result: r }
      )

      // /pipeline expects an array; single command expects one object.
      if (url === "/pipeline" || url === "/multi-exec") {
        res.end(JSON.stringify(shaped))
      } else {
        res.end(JSON.stringify(shaped[0] ?? { result: null }))
      }
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({ error: String(err?.message ?? err) }))
    }
  })
})

server.listen(HTTP_PORT, "127.0.0.1", () => {
  console.log(
    `[local-redis-http] listening on http://127.0.0.1:${HTTP_PORT} → redis ${REDIS_HOST}:${REDIS_PORT}`
  )
})
