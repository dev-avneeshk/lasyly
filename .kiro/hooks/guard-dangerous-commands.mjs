// PreToolUse guard: forces an "ask" prompt for dangerous shell commands even
// though kiroAgent.trustedCommands contains "*".
// Asks for: rm (unless every target is under /tmp or the audit worktree),
// psql, vercel, git push, supabase db push/reset, npm run db:apply.
import { readFileSync } from 'node:fs'
import path from 'node:path'

const SAFE_RM_ROOTS = [
  '/tmp/',
  '/private/tmp/',
  '/Users/ayushkumar/development/betroom/.worktrees/audit/',
  '/Users/ayushkumar/development/betroom/.agents/tasks/lasyly-audit-2026-10-02/scratch/',
]

let input = {}
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}') } catch { /* not JSON */ }

// Find the first string field with the given key anywhere in the payload, so the
// guard still works if the hook payload nests tool arguments differently.
const find = (obj, key, depth = 0) => {
  if (!obj || typeof obj !== 'object' || depth > 5) return undefined
  if (typeof obj[key] === 'string') return obj[key]
  for (const v of Object.values(obj)) {
    const hit = find(typeof v === 'string' && v.startsWith('{') ? safeParse(v) : v, key, depth + 1)
    if (hit !== undefined) return hit
  }
}
function safeParse(s) { try { return JSON.parse(s) } catch { return undefined } }
const command = find(input, 'command') ?? ''
const cwd = find(input, 'cwd') ?? ''
if (!command) process.exit(0)

// Split into simple commands on shell separators, drop leading env assignments / sudo / time.
const segments = command
  .split(/&&|\|\||[;|\n`]|\$\(/)
  .map(s => s.trim().split(/\s+/).filter(Boolean))
  .map(words => {
    while (words.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0]) || ['sudo', 'time', 'command', 'exec', 'nohup', 'xargs', 'env'].includes(words[0]))) words.shift()
    return words
  })
  .filter(w => w.length)

const base = w => path.basename(w)
const reasons = []

for (const w of segments) {
  const cmd = base(w[0])
  const rest = w.slice(1)
  if (cmd === 'rm' || (cmd === 'git' && rest.find(a => !a.startsWith('-')) === 'rm')) {
    const targets = rest.filter(a => !a.startsWith('-') && a !== 'rm')
    const safe = targets.length > 0 && targets.every(t => {
      const unq = t.replace(/^['"]|['"]$/g, '')
      const abs = path.isAbsolute(unq) ? unq : cwd ? path.resolve(cwd, unq) : null
      return abs && !abs.includes('..') && SAFE_RM_ROOTS.some(r => (abs + '/').startsWith(r) && abs + '/' !== r)
    })
    if (!safe) reasons.push(`rm: ${w.join(' ')}`)
  }
  if (cmd === 'psql' || cmd === 'pg_dump' || cmd === 'pg_restore') reasons.push(`${cmd} (database access)`)
  if (cmd === 'vercel' || (['npx', 'pnpm', 'bunx'].includes(cmd) && base(rest[0] ?? '') === 'vercel')) reasons.push('vercel CLI')
  if (cmd === 'git' && rest.includes('push')) reasons.push('git push')
  if ((cmd === 'supabase' || (cmd === 'npx' && rest[0] === 'supabase')) && /\b(db\s+(push|reset)|migration\s+up)\b/.test(w.join(' '))) reasons.push('supabase remote migration')
  if (cmd === 'npm' && rest.includes('db:apply')) reasons.push('npm run db:apply')
}

if (reasons.length) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      permissionDecision: 'ask',
      permissionDecisionReason: `Guarded command needs your approval: ${[...new Set(reasons)].join('; ')}`,
    },
  }))
}
process.exit(0)
