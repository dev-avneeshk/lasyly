import { RoomShellSkeleton } from "@/components/room/skeletons"

// Deepest boundary wins, so this replaces the rooms-list card grid that used
// to flash when opening a room.
export default function RoomLoading() {
  return <RoomShellSkeleton />
}
