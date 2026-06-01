"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  User,
  Edit3,
  Check,
  X,
  Trophy,
  Target,
  TrendingUp,
  Calendar,
  MapPin,
  BadgeCheck,
  Users,
  LogOut,
  Camera,
  Download,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

const SPORTS = ["Football", "Basketball", "Tennis", "Cricket", "NFL", "Formula 1", "Esports", "MMA", "Boxing", "Golf"]

type Profile = {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  favourite_sports: string[] | null
  country: string | null
  account_type: string | null
  is_verified: boolean
  created_at: string
}

type Stats = {
  followerCount: number
  followingCount: number
  totalPicks: number
  winRate: number
  averageOdds: number
  wonCount: number
  lostCount: number
  pendingCount: number
}

type Props = {
  profile: Profile
  stats: Stats
}

export default function ProfileClient({ profile: initialProfile, stats }: Props) {
  const router = useRouter()
  const [profile, setProfile] = useState(initialProfile)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Edit form state
  const [editForm, setEditForm] = useState({
    display_name: profile.display_name,
    bio: profile.bio || "",
    country: profile.country || "",
    favourite_sports: profile.favourite_sports || [],
  })

  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  const handleStartEdit = () => {
    setEditForm({
      display_name: profile.display_name,
      bio: profile.bio || "",
      country: profile.country || "",
      favourite_sports: profile.favourite_sports || [],
    })
    setIsEditing(true)
    setError(null)
    setSuccess(null)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setError(null)
  }

  const toggleSport = (sport: string) => {
    setEditForm((prev) => ({
      ...prev,
      favourite_sports: prev.favourite_sports.includes(sport)
        ? prev.favourite_sports.filter((s) => s !== sport)
        : [...prev.favourite_sports, sport],
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch("/api/profiles/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: editForm.display_name,
          bio: editForm.bio || null,
          country: editForm.country || null,
          favourite_sports: editForm.favourite_sports.length > 0 ? editForm.favourite_sports : null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to save changes.")
        setIsSaving(false)
        return
      }

      const updated = await res.json()
      setProfile((prev) => ({ ...prev, ...updated }))
      setIsEditing(false)
      setSuccess("Profile updated successfully.")
      setTimeout(() => setSuccess(null), 3000)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      await fetch("/api/auth/guest", { method: "DELETE" })
    } catch {
      // proceed with client-side cleanup
    }
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 md:py-12">
      {/* Header card */}
      <div className="relative rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 backdrop-blur-sm overflow-hidden">
        {/* Gradient banner */}
        <div className="h-28 md:h-36 bg-gradient-to-br from-[var(--color-lime)]/20 via-[var(--color-lime)]/5 to-transparent" />

        {/* Avatar + name */}
        <div className="px-6 md:px-8 pb-6 -mt-14 md:-mt-16">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-[var(--color-surface)] bg-[var(--color-surface)] overflow-hidden shadow-lg">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    width={112}
                    height={112}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[var(--color-lime)]/10">
                    <User className="w-10 h-10 text-[var(--color-lime)]" />
                  </div>
                )}
              </div>
              {profile.is_verified && (
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[var(--color-lime)] flex items-center justify-center border-2 border-[var(--color-surface)]">
                  <BadgeCheck className="w-4 h-4 text-black" />
                </div>
              )}
            </div>

            {/* Name + username */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold text-white truncate">
                  {profile.display_name}
                </h1>
                {profile.account_type === "tipster" && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--color-lime)]/10 text-[var(--color-lime)] border border-[var(--color-lime)]/20">
                    Seller
                  </span>
                )}
                {profile.account_type === "both" && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--color-lime)]/10 text-[var(--color-lime)] border border-[var(--color-lime)]/20">
                    Seller
                  </span>
                )}
              </div>
              <p className="text-[var(--color-text-muted)] text-sm mt-0.5">@{profile.username}</p>
            </div>

            {/* Edit button */}
            <div className="sm:ml-auto">
              {!isEditing ? (
                <Button
                  onClick={handleStartEdit}
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-full border-white/10 hover:border-[var(--color-lime)]/30 hover:bg-[var(--color-lime)]/5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Profile
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    size="sm"
                    className="gap-2 rounded-full bg-[var(--color-lime)] text-black hover:opacity-90 border-none"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    onClick={handleCancelEdit}
                    variant="ghost"
                    size="sm"
                    className="rounded-full"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {!isEditing && profile.bio && (
            <p className="mt-4 text-sm text-white/80 leading-relaxed max-w-lg">
              {profile.bio}
            </p>
          )}

          {/* Meta info */}
          {!isEditing && (
            <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Joined {memberSince}
              </span>
              {profile.country && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {profile.country}
                </span>
              )}
            </div>
          )}

          {/* Follower counts */}
          {!isEditing && (
            <div className="flex gap-5 mt-4">
              <span className="text-sm">
                <span className="font-bold text-white">{stats.followerCount}</span>{" "}
                <span className="text-[var(--color-text-muted)]">followers</span>
              </span>
              <span className="text-sm">
                <span className="font-bold text-white">{stats.followingCount}</span>{" "}
                <span className="text-[var(--color-text-muted)]">following</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Success/Error messages */}
      {success && (
        <div className="mt-4 p-3 rounded-xl bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 text-sm text-[var(--color-success)] flex items-center gap-2">
          <Check className="w-4 h-4" />
          {success}
        </div>
      )}
      {error && (
        <div className="mt-4 p-3 rounded-xl bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {/* Edit form */}
      {isEditing && (
        <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-6 space-y-5">
          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Edit Profile</h3>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">Display Name</label>
            <Input
              value={editForm.display_name}
              onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))}
              maxLength={50}
              className="bg-black/20 border-white/10 focus-visible:ring-[var(--color-lime)]/50 focus-visible:border-[var(--color-lime)] h-11"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">Bio</label>
            <textarea
              value={editForm.bio}
              onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
              maxLength={500}
              rows={3}
              placeholder="Tell people about yourself..."
              className="w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-lime)]/50 focus:border-[var(--color-lime)] resize-none"
            />
            <p className="text-xs text-[var(--color-text-muted)]">{editForm.bio.length}/500</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">Country</label>
            <Input
              value={editForm.country}
              onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))}
              maxLength={100}
              placeholder="e.g. United States"
              className="bg-black/20 border-white/10 focus-visible:ring-[var(--color-lime)]/50 focus-visible:border-[var(--color-lime)] h-11"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-white/80">Favourite Sports</label>
            <div className="flex flex-wrap gap-2">
              {SPORTS.map((sport) => {
                const isSelected = editForm.favourite_sports.includes(sport)
                return (
                  <button
                    key={sport}
                    type="button"
                    onClick={() => toggleSport(sport)}
                    className={`px-3.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-[var(--color-lime)]/10 border-[var(--color-lime)]/50 text-[var(--color-lime)]"
                        : "bg-black/20 border-white/10 text-[var(--color-text-muted)] hover:border-white/20"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                    {sport}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      {!isEditing && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<Target className="w-4 h-4 text-[var(--color-lime)]" />}
            label="Total Picks"
            value={stats.totalPicks.toString()}
          />
          <StatCard
            icon={<Trophy className="w-4 h-4 text-[var(--color-success)]" />}
            label="Win Rate"
            value={`${stats.winRate}%`}
          />
          <StatCard
            icon={<TrendingUp className="w-4 h-4 text-blue-400" />}
            label="Avg Odds"
            value={stats.averageOdds > 0 ? stats.averageOdds.toFixed(2) : "—"}
          />
          <StatCard
            icon={<Users className="w-4 h-4 text-purple-400" />}
            label="Record"
            value={`${stats.wonCount}W-${stats.lostCount}L`}
          />
        </div>
      )}

      {/* Sports tags */}
      {!isEditing && profile.favourite_sports && profile.favourite_sports.length > 0 && (
        <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-5">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
            Favourite Sports
          </h3>
          <div className="flex flex-wrap gap-2">
            {profile.favourite_sports.map((sport) => (
              <span
                key={sport}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/80"
              >
                {sport}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Account section */}
      {!isEditing && (
        <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-5">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
            Account
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-white/80">Username</span>
              <span className="text-sm text-[var(--color-text-muted)]">@{profile.username}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-white/5">
              <span className="text-sm text-white/80">Account Type</span>
              <span className="text-sm text-[var(--color-text-muted)] capitalize">{profile.account_type || "—"}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-white/5">
              <span className="text-sm text-white/80">Verified</span>
              <span className="text-sm text-[var(--color-text-muted)]">
                {profile.is_verified ? "Yes ✓" : "No"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[var(--color-danger)]/20 text-[var(--color-danger)] text-sm font-medium hover:bg-[var(--color-danger)]/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>

          <a
            href="/api/export/bets"
            download
            className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] text-sm font-medium hover:bg-white/5 hover:text-white transition-colors"
          >
            <Download className="w-4 h-4" />
            Export History
          </a>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-lg font-bold text-white">{value}</span>
    </div>
  )
}
