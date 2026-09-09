"use client"

import { useState, useEffect } from "react"
import { Play, Loader2, History, CheckCircle2, AlertTriangle, XCircle } from "lucide-react"

interface Version {
  ranking_version: string
  status: string
  generated_at: string
  player_count: number
  team_count: number
  algorithm_version: string
}

export default function RankingsAdminPage() {
  const [season, setSeason] = useState("2026-27")
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingVersions, setLoadingVersions] = useState(true)
  const [result, setResult] = useState<any>(null)
  const [secret, setSecret] = useState("")

  useEffect(() => {
    fetchVersions()
  }, [season, secret])

  async function fetchVersions() {
    setLoadingVersions(true)
    try {
      const res = await fetch(`/api/jobs/generate-rankings?season=${season}&secret=${secret}`)
      if (res.ok) {
        const data = await res.json()
        setVersions(data.versions ?? [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingVersions(false)
    }
  }

  async function handleGenerate(dryRun: boolean, includeHistorical: boolean) {
    if (!secret) return alert("Secret required")
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch(`/api/jobs/generate-rankings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-rankings-secret": secret,
        },
        body: JSON.stringify({
          season,
          historical_season: "2025-26",
          dry_run: dryRun,
          include_historical: includeHistorical,
          is_projection: season === "2026-27",
        }),
      })

      const data = await res.json()
      setResult({ status: res.status, data })
      if (!dryRun && res.ok) {
        fetchVersions()
      }
    } catch (err: any) {
      setResult({ status: 500, data: { error: err.message } })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-20 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white">Ranking Engine Admin</h1>
        <p className="text-[var(--color-text-muted)] text-sm mt-1">
          Trigger algorithmic generation of NBA player and team rankings.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* ── Controls ─────────────────────────────────────────────────── */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Generation Controls</h2>

            <div>
              <label className="text-xs font-bold text-[var(--color-text-muted)] block mb-1">Target Season</label>
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-[var(--color-lime)] outline-none"
              >
                <option value="2026-27">2026-27 Projection</option>
                <option value="2025-26">2025-26 Historical</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--color-text-muted)] block mb-1">Job Secret (Auth)</label>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Enter RANKINGS_JOB_SECRET"
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-[var(--color-lime)] outline-none"
              />
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => handleGenerate(false, false)}
                disabled={loading || !secret}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-[var(--color-lime)] text-black font-bold hover:bg-[var(--color-lime)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Generate New Version
              </button>
              
              <button
                onClick={() => handleGenerate(true, false)}
                disabled={loading || !secret}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-white/10 text-white font-bold hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Dry Run (No DB Write)
              </button>
            </div>
          </div>

          {/* ── Result Status ──────────────────────────────────────────────── */}
          {result && (
            <div className={`border rounded-2xl p-6 ${result.data.success ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
              <div className="flex items-center gap-2 mb-3">
                {result.data.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
                <h3 className="font-bold text-white">
                  {result.data.success ? "Generation Successful" : "Generation Failed"}
                </h3>
              </div>
              
              <div className="text-xs font-mono bg-black/40 rounded-lg p-4 overflow-auto max-h-64 whitespace-pre-wrap">
                {JSON.stringify(result.data, null, 2)}
              </div>
            </div>
          )}
        </div>

        {/* ── Version History ────────────────────────────────────────────── */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 h-[500px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <History className="w-4 h-4" />
              Recent Versions ({season})
            </h2>
          </div>

          <div className="flex-1 overflow-auto pr-2 space-y-3">
            {loadingVersions ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-muted)]" /></div>
            ) : versions.length === 0 ? (
              <div className="text-center py-10 text-sm text-[var(--color-text-muted)]">
                No versions found. Enter secret to view or generate.
              </div>
            ) : (
              versions.map((v) => (
                <div key={v.ranking_version} className="bg-white/5 border border-white/5 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-sm text-[var(--color-lime)]">{v.ranking_version}</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${v.status === 'published' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/50'}`}>
                      {v.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-[var(--color-text-muted)]">
                    <div>Algorithm: {v.algorithm_version}</div>
                    <div>Players: {v.player_count ?? "—"}</div>
                    <div>Teams: {v.team_count ?? "—"}</div>
                    <div>Generated: {new Date(v.generated_at).toLocaleString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
