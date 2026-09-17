import { Anton } from "next/font/google"

/**
 * The quiz screens use a condensed display face for their editorial headlines
 * (the big question type, the question counter, the pull-quote). It's loaded
 * here rather than in the root layout so the extra font file only ships to
 * /quiz routes — nothing else in the app uses it.
 */
const anton = Anton({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-anton",
  display: "swap",
  preload: false,
})

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return <div className={anton.variable}>{children}</div>
}
