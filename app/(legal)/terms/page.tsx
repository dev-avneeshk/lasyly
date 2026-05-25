import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Terms of Service — Lasyly",
  description: "Lasyly Terms of Service. Rules and conditions for using the platform.",
}

export default function TermsOfServicePage() {
  return (
    <article className="prose prose-invert prose-sm max-w-none">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="text-[var(--color-text-muted)]">Last updated: May 22, 2026</p>

      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of the Lasyly platform (&quot;Service&quot;) operated by Lasyly (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By accessing or using the Service, you agree to be bound by these Terms.
      </p>

      <h2>1. Eligibility</h2>
      <ul>
        <li>You must be at least 18 years old to use Lasyly.</li>
        <li>You must comply with all applicable laws in your jurisdiction regarding sports betting and related activities.</li>
        <li>You are responsible for ensuring that your use of Lasyly does not violate any local, state, or national laws.</li>
      </ul>

      <h2>2. Account Responsibilities</h2>
      <ul>
        <li>You are responsible for maintaining the security of your account credentials.</li>
        <li>You must provide accurate information when creating your account.</li>
        <li>You may not create multiple accounts or share your account with others.</li>
        <li>You must notify us immediately if you suspect unauthorized access to your account.</li>
        <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
      </ul>

      <h2>3. Nature of the Service</h2>
      <p><strong>Lasyly is an analytics and social platform — not a sportsbook or gambling operator.</strong></p>
      <ul>
        <li>We do not accept, place, or facilitate bets or wagers.</li>
        <li>We do not offer odds, accept stakes, or pay out winnings.</li>
        <li>Prop lines displayed on the platform are computed from historical player performance data for informational and analytical purposes only.</li>
        <li>Any betting decisions you make based on information from Lasyly are entirely your own responsibility.</li>
        <li>We do not guarantee the accuracy, completeness, or timeliness of any analytics, scores, or data displayed.</li>
      </ul>

      <h2>4. Tipster Marketplace</h2>
      <h3>4.1 For Buyers</h3>
      <ul>
        <li>Purchases of premium picks are made using wallet credits and are non-refundable once the pick is revealed.</li>
        <li>Tipster picks are opinions and analysis — not guaranteed outcomes.</li>
        <li>Past performance of a tipster does not guarantee future results.</li>
      </ul>
      <h3>4.2 For Tipsters</h3>
      <ul>
        <li>Tipsters earn 85% of the purchase price; Lasyly retains a 15% platform fee.</li>
        <li>Tipsters must provide honest analysis. Deliberately misleading picks or manipulation of performance stats will result in account termination.</li>
        <li>Earnings are subject to applicable tax obligations in your jurisdiction. You are responsible for reporting your income.</li>
        <li>We reserve the right to adjust the revenue split with 30 days&apos; notice.</li>
      </ul>

      <h2>5. Wallet and Payments</h2>
      <ul>
        <li>Wallet credits are purchased via Stripe and are denominated in USD.</li>
        <li>Credits are non-transferable between accounts.</li>
        <li>Unused credits do not expire while your account is active.</li>
        <li>Refunds for wallet top-ups are handled on a case-by-case basis and are not guaranteed.</li>
        <li>In the event of account termination for Terms violations, remaining credits may be forfeited.</li>
        <li>We reserve the right to modify pricing and credit values with reasonable notice.</li>
      </ul>

      <h2>6. User Conduct</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Post spam, harassment, hate speech, or illegal content in rooms or chat</li>
        <li>Impersonate other users, tipsters, or Lasyly staff</li>
        <li>Attempt to manipulate analytics, hit rates, or leaderboard rankings</li>
        <li>Scrape, crawl, or programmatically access the Service without permission</li>
        <li>Reverse engineer, decompile, or attempt to extract source code</li>
        <li>Use the Service to facilitate illegal gambling in jurisdictions where it is prohibited</li>
        <li>Circumvent rate limits, security measures, or access controls</li>
        <li>Upload malware, viruses, or malicious code</li>
        <li>Create bots or automated accounts</li>
      </ul>

      <h2>7. Content Ownership</h2>
      <h3>7.1 Your Content</h3>
      <p>
        You retain ownership of content you create (betslips, chat messages, picks). By posting content on Lasyly, you grant us a non-exclusive, worldwide, royalty-free license to display, distribute, and store that content as part of operating the Service.
      </p>
      <h3>7.2 Our Content</h3>
      <p>
        All analytics, computed prop lines, matchup grades, confidence scores, and other derived data are the intellectual property of Lasyly. You may not reproduce, redistribute, or commercially exploit this data without written permission.
      </p>
      <h3>7.3 Third-Party Data</h3>
      <p>
        Live scores, team logos, and news content are sourced from third-party providers (ESPN and others). These remain the property of their respective owners and are displayed under fair use for informational purposes.
      </p>

      <h2>8. Disclaimers</h2>
      <ul>
        <li>The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind.</li>
        <li>We do not guarantee uninterrupted access, accuracy of data, or specific outcomes from using our analytics.</li>
        <li>Sports data, prop lines, and analytics are for informational purposes only and should not be considered financial or betting advice.</li>
        <li>We are not responsible for any losses incurred from betting decisions made using information from the Service.</li>
      </ul>

      <h2>9. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, Lasyly shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or goodwill, arising from your use of the Service.
      </p>
      <p>
        Our total liability for any claim arising from these Terms or the Service shall not exceed the amount you paid to Lasyly in the 12 months preceding the claim.
      </p>

      <h2>10. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless Lasyly, its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including legal fees) arising from your use of the Service, violation of these Terms, or infringement of any third-party rights.
      </p>

      <h2>11. Termination</h2>
      <ul>
        <li>You may delete your account at any time through your profile settings.</li>
        <li>We may suspend or terminate your account for violations of these Terms, with or without notice.</li>
        <li>Upon termination, your right to use the Service ceases immediately.</li>
        <li>Sections that by their nature should survive termination (Disclaimers, Limitation of Liability, Indemnification) will survive.</li>
      </ul>

      <h2>12. Modifications to the Service</h2>
      <p>
        We reserve the right to modify, suspend, or discontinue any part of the Service at any time. We will make reasonable efforts to notify users of material changes. Continued use after changes constitutes acceptance.
      </p>

      <h2>13. Governing Law</h2>
      <p>
        These Terms are governed by and construed in accordance with applicable laws. Any disputes arising from these Terms or the Service shall be resolved through binding arbitration, except where prohibited by law.
      </p>

      <h2>14. Severability</h2>
      <p>
        If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.
      </p>

      <h2>15. Contact Us</h2>
      <p>
        If you have questions about these Terms, contact us at:
      </p>
      <ul>
        <li>Email: <strong>dev.avneeshkumar@gmail.com</strong></li>
        <li>Instagram: <strong><a href="https://instagram.com/dev.avneeshk" target="_blank" rel="noopener noreferrer">@dev.avneeshk</a></strong></li>
      </ul>

      <div className="mt-12 pt-6 border-t border-[var(--color-border)]">
        <Link href="/privacy" className="text-[var(--color-lime)] hover:underline text-sm">
          View Privacy Policy →
        </Link>
      </div>
    </article>
  )
}
