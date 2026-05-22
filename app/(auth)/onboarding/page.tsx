"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Camera, Check, AlertCircle, TrendingUp, Users, Zap } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

const SPORTS = ["Football", "Basketball", "Tennis", "Cricket", "NFL", "Formula 1", "Esports", "MMA", "Boxing", "Golf"]

const INTENTS = [
  {
    id: "bettor",
    title: "I'm here to follow & bet",
    description: "Get tips from top tipsters, join rooms, and track your bets.",
    icon: TrendingUp,
    color: "var(--color-primary)",
  },
  {
    id: "tipster",
    title: "I'm a Tipster",
    description: "Share premium picks, build a following, and earn from your expertise.",
    icon: Zap,
    color: "var(--color-secondary)",
  },
  {
    id: "both",
    title: "Both — I tip & bet",
    description: "Share your own picks while following others. Best of both worlds.",
    icon: Users,
    color: "var(--color-lime)",
  },
] as const

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [step, setStep] = useState(1) // 1: Intent, 2: Profile, 3: Sports
  const [accountType, setAccountType] = useState<string | null>(null)
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [selectedSports, setSelectedSports] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)

  // Load user data from Google on mount
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const googleAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || ""
        const googleName = user.user_metadata?.full_name || user.user_metadata?.name || ""
        setAvatarUrl(googleAvatar)
        setDisplayName(googleName)
      }
    }
    loadUser()
  }, [supabase])

  // Debounced username availability check
  useEffect(() => {
    if (username.length < 3) { setUsernameAvailable(null); return }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setUsernameAvailable(null); return }

    const timer = setTimeout(async () => {
      setCheckingUsername(true)
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username.toLowerCase())
        .maybeSingle()
      setUsernameAvailable(!data)
      setCheckingUsername(false)
    }, 400)

    return () => clearTimeout(timer)
  }, [username, supabase])

  const toggleSport = (sport: string) => {
    setSelectedSports((prev) =>
      prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]
    )
  }

  const handleIntentContinue = () => {
    if (!accountType) { setError("Please select how you'll use Lasyly."); return }
    setError(null)
    setStep(2)
  }

  const handleProfileContinue = () => {
    if (!username || username.length < 3) { setError("Username must be at least 3 characters."); return }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setError("Username can only contain letters, numbers, and underscores."); return }
    if (usernameAvailable === false) { setError("This username is already taken."); return }
    setError(null)
    setStep(3)
  }

  const handleFinish = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/profiles/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.toLowerCase(),
          display_name: displayName || username,
          avatar_url: avatarUrl || undefined,
          favourite_sports: selectedSports.length > 0 ? selectedSports : undefined,
          account_type: accountType,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Something went wrong.")
        setIsLoading(false)
        return
      }

      router.push("/explore")
      router.refresh()
    } catch {
      setError("Failed to save profile. Please try again.")
      setIsLoading(false)
    }
  }

  const stepTitles: Record<number, { title: string; subtitle: string }> = {
    1: { title: "How will you use Lasyly?", subtitle: "This helps us personalize your experience." },
    2: { title: "Set up your profile", subtitle: "Choose a unique username and set your display name." },
    3: { title: "What do you bet on?", subtitle: "Select your favorite sports to personalize your feed." },
  }

  return (
    <div className="w-full">
      {/* Progress indicator */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-all ${
              s <= step ? "bg-[var(--color-lime)]" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">{stepTitles[step].title}</h2>
        <p className="text-[var(--color-text-muted)]">{stepTitles[step].subtitle}</p>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-sm text-[var(--color-danger)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: Intent */}
      {step === 1 && (
        <div className="space-y-4">
          {INTENTS.map((intent) => {
            const isSelected = accountType === intent.id
            return (
              <button
                key={intent.id}
                onClick={() => setAccountType(intent.id)}
                className={`w-full p-5 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 shadow-[0_0_20px_rgba(212,255,0,0.2)]"
                    : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                      isSelected ? "bg-[var(--color-lime)]/20" : "bg-white/5"
                    }`}
                    style={{ color: isSelected ? intent.color : "var(--color-text-muted)" }}
                  >
                    <intent.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-bold text-lg mb-1 ${isSelected ? "text-white" : "text-white/80"}`}>
                      {intent.title}
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)]">{intent.description}</p>
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-[var(--color-lime)] flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 text-black" />
                    </div>
                  )}
                </div>
              </button>
            )
          })}

          <Button
            onClick={handleIntentContinue}
            disabled={!accountType}
            className="w-full h-12 text-base font-semibold tracking-wide bg-[var(--color-lime)] text-black hover:opacity-90 transition-opacity border-none shadow-[0_4px_14px_rgba(212,255,0,0.4)] mt-6"
          >
            Continue
          </Button>
        </div>
      )}

      {/* Step 2: Profile */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="flex flex-col items-center py-4">
            <div className="relative group cursor-pointer">
              <div className="w-28 h-28 rounded-full border-2 border-[var(--color-lime)]/50 bg-[var(--color-surface)] flex items-center justify-center overflow-hidden transition-all group-hover:border-[var(--color-lime)]">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8 text-[var(--color-lime)]/50" />
                )}
              </div>
              {avatarUrl && (
                <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[var(--color-lime)] flex items-center justify-center border-2 border-[var(--color-surface)]">
                  <Check className="w-3.5 h-3.5 text-black" />
                </div>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-2">Using your Google photo</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/90">Username</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-sm">@</span>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                placeholder="choose_a_username"
                maxLength={20}
                className="bg-black/20 border-white/10 focus-visible:ring-[var(--color-lime)]/50 focus-visible:border-[var(--color-lime)] h-12 pl-8"
              />
              {username.length >= 3 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingUsername ? (
                    <span className="text-xs text-[var(--color-text-muted)]">checking...</span>
                  ) : usernameAvailable === true ? (
                    <Check className="w-4 h-4 text-[var(--color-success)]" />
                  ) : usernameAvailable === false ? (
                    <span className="text-xs text-[var(--color-danger)]">taken</span>
                  ) : null}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">3-20 characters. Letters, numbers, and underscores only.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/90">Display Name</label>
            <Input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Name"
              maxLength={50}
              className="bg-black/20 border-white/10 focus-visible:ring-[var(--color-lime)]/50 focus-visible:border-[var(--color-lime)] h-12"
            />
          </div>

          <Button
            onClick={handleProfileContinue}
            disabled={!username || username.length < 3 || usernameAvailable === false || checkingUsername}
            className="w-full h-12 text-base font-semibold tracking-wide bg-[var(--color-lime)] text-black hover:opacity-90 transition-opacity border-none shadow-[0_4px_14px_rgba(212,255,0,0.4)]"
          >
            Continue
          </Button>
        </div>
      )}

      {/* Step 3: Sports */}
      {step === 3 && (
        <div className="space-y-8 py-2">
          <div className="flex flex-wrap gap-3">
            {SPORTS.map((sport) => {
              const isSelected = selectedSports.includes(sport)
              return (
                <button
                  key={sport}
                  onClick={() => toggleSport(sport)}
                  className={`px-5 py-3 rounded-xl border flex items-center gap-2 font-medium text-sm transition-all ${
                    isSelected
                      ? "bg-[var(--color-lime)]/10 border-[var(--color-lime)] text-[var(--color-lime)] shadow-[0_0_15px_rgba(212,255,0,0.2)]"
                      : "bg-black/20 border-white/10 text-[var(--color-text-muted)] hover:bg-white/5 hover:border-white/20"
                  }`}
                >
                  {isSelected && <Check className="w-4 h-4" />}
                  {sport}
                </button>
              )
            })}
          </div>

          <Button
            onClick={handleFinish}
            disabled={isLoading}
            className="w-full h-12 text-base font-semibold tracking-wide bg-[var(--color-lime)] text-black hover:opacity-90 transition-opacity border-none shadow-[0_4px_14px_rgba(212,255,0,0.4)]"
          >
            {isLoading ? "Setting things up..." : "Let's Go 🚀"}
          </Button>
        </div>
      )}
    </div>
  )
}
