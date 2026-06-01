import WalletClient from "./WalletClient"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Wallet | Lasyly",
  robots: { index: false },
}

export default function WalletPage() {
  return <WalletClient />
}
