export const ACHIEVEMENTS = {
  first_pick: { name: "First Pick", description: "Logged your first pick", icon: "🎯" },
  win_streak_3: { name: "Hot Hand", description: "3 wins in a row", icon: "🔥" },
  win_streak_5: { name: "On Fire", description: "5 wins in a row", icon: "💥" },
  win_streak_10: { name: "Unstoppable", description: "10 wins in a row", icon: "⚡" },
  picks_10: { name: "Getting Started", description: "10 picks logged", icon: "📊" },
  picks_50: { name: "Consistent", description: "50 picks logged", icon: "📈" },
  picks_100: { name: "Century", description: "100 picks logged", icon: "💯" },
  win_rate_60: { name: "Sharp Eye", description: "60%+ win rate (min 20 picks)", icon: "👁️" },
  win_rate_70: { name: "Elite", description: "70%+ win rate (min 20 picks)", icon: "🏆" },
  first_follower: { name: "Social", description: "Got your first follower", icon: "👥" },
  followers_10: { name: "Rising Star", description: "10 followers", icon: "⭐" },
  followers_50: { name: "Influencer", description: "50 followers", icon: "🌟" },
} as const

export type AchievementKey = keyof typeof ACHIEVEMENTS
