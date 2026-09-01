// Shared types for the room channels / sub-channels feature.

export type SubchannelVisibility = "public" | "private"
export type PostPolicy = "everyone" | "members" | "admins"
export type JoinPolicy = "open" | "request"

export type Subchannel = {
  id: string
  channel_id: string
  name: string
  topic: string | null
  icon: string | null
  position: number
  visibility: SubchannelVisibility
  post_policy: PostPolicy
  join_policy: JoinPolicy
  slug: string
  is_default: boolean
}



export type JoinRequest = {
  id: string
  subchannelId: string
  subchannelName: string | null
  userId: string
  requestedAt: string
  profile: {
    username: string | null
    display_name: string | null
    avatar_url: string | null
  } | null
}
