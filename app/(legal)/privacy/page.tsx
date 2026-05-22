import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy — Lasyly",
  description: "Lasyly Privacy Policy. Learn how we collect, use, and protect your data.",
}

export default function PrivacyPolicyPage() {
  return (
    <article className="prose prose-invert prose-sm max-w-none">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="text-[var(--color-text-muted)]">Last updated: May 22, 2026</p>

      <p>
        Lasyly (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the Lasyly platform (the &quot;Service&quot;). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.
      </p>

      <h2>1. Information We Collect</h2>

      <h3>1.1 Account Information</h3>
      <p>When you create an account, we collect:</p>
      <ul>
        <li>Email address</li>
        <li>Display name and username</li>
        <li>Profile avatar (if uploaded)</li>
        <li>Account type preference (bettor, tipster, or both)</li>
        <li>Favorite sports selections</li>
      </ul>

      <h3>1.2 Authentication Data</h3>
      <p>
        We use Supabase for authentication. If you sign in via Google OAuth, we receive your name, email, and profile picture from Google. We do not store your Google password.
      </p>

      <h3>1.3 Usage Data</h3>
      <p>We automatically collect:</p>
      <ul>
        <li>Pages visited and features used</li>
        <li>Device type, browser, and operating system</li>
        <li>IP address (for security and rate limiting)</li>
        <li>Timestamps of interactions</li>
      </ul>

      <h3>1.4 User-Generated Content</h3>
      <p>Content you create on the platform, including:</p>
      <ul>
        <li>Chat messages in rooms</li>
        <li>Betslips and pick logs</li>
        <li>Votes and reactions</li>
        <li>Room descriptions and settings</li>
      </ul>

      <h3>1.5 Payment Information</h3>
      <p>
        Payments are processed by Stripe. We do not store your credit card number, CVV, or full card details. We receive from Stripe: transaction amounts, timestamps, and a payment reference ID. Stripe&apos;s privacy policy governs their handling of your payment data.
      </p>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li><strong>Provide the Service</strong> — display analytics, deliver live scores, enable rooms and chat</li>
        <li><strong>Personalize your experience</strong> — show relevant sports, props, and content based on your preferences</li>
        <li><strong>Process transactions</strong> — handle wallet top-ups, tipster purchases, and earnings</li>
        <li><strong>Improve the platform</strong> — analyze usage patterns to fix bugs and build better features</li>
        <li><strong>Security</strong> — detect abuse, enforce rate limits, and protect against unauthorized access</li>
        <li><strong>Communications</strong> — send account-related emails (password resets, security alerts). We do not send marketing emails without your consent.</li>
      </ul>

      <h2>3. How We Share Your Information</h2>
      <p>We do not sell your personal data. We share information only in these cases:</p>
      <ul>
        <li><strong>Service providers</strong> — Supabase (database/auth), Stripe (payments), Vercel (hosting). These providers process data on our behalf under contractual obligations.</li>
        <li><strong>Public content</strong> — Your username, display name, avatar, and public betslips are visible to other users.</li>
        <li><strong>Legal requirements</strong> — If required by law, court order, or to protect our rights and safety.</li>
        <li><strong>Business transfers</strong> — In the event of a merger, acquisition, or sale of assets, user data may be transferred to the acquiring entity.</li>
      </ul>

      <h2>4. Data Retention</h2>
      <ul>
        <li><strong>Account data</strong> — retained while your account is active. Deleted within 30 days of account deletion request.</li>
        <li><strong>Chat messages</strong> — automatically deleted after 24 hours.</li>
        <li><strong>Bet logs and analytics</strong> — retained while your account is active.</li>
        <li><strong>Payment records</strong> — retained for 7 years for tax and legal compliance.</li>
        <li><strong>Security logs</strong> — IP addresses and rate limit data retained for 90 days.</li>
      </ul>

      <h2>5. Data Security</h2>
      <p>We implement industry-standard security measures including:</p>
      <ul>
        <li>AES-256-GCM encryption for sensitive data at rest</li>
        <li>TLS 1.3 for all data in transit</li>
        <li>Row Level Security (RLS) on all database tables</li>
        <li>Rate limiting and IP blocking for abuse prevention</li>
        <li>Security headers (CSP, HSTS, X-Frame-Options)</li>
        <li>Regular security audits</li>
      </ul>

      <h2>6. Your Rights</h2>
      <p>Depending on your jurisdiction, you may have the right to:</p>
      <ul>
        <li><strong>Access</strong> — request a copy of your personal data</li>
        <li><strong>Correction</strong> — update inaccurate information</li>
        <li><strong>Deletion</strong> — request deletion of your account and associated data</li>
        <li><strong>Portability</strong> — receive your data in a machine-readable format</li>
        <li><strong>Objection</strong> — object to certain processing of your data</li>
      </ul>
      <p>To exercise these rights, contact us at <strong>privacy@lasyly.com</strong>.</p>

      <h2>7. Cookies</h2>
      <p>We use essential cookies for:</p>
      <ul>
        <li>Authentication session management</li>
        <li>Guest browsing mode</li>
      </ul>
      <p>We do not use third-party advertising or tracking cookies.</p>

      <h2>8. Age Restriction</h2>
      <p>
        Lasyly is intended for users aged 18 and older. We do not knowingly collect data from anyone under 18. If we learn that a user is under 18, we will delete their account and data promptly.
      </p>

      <h2>9. International Data Transfers</h2>
      <p>
        Your data may be processed in countries other than your own. Our service providers (Supabase, Stripe, Vercel) operate globally. We ensure appropriate safeguards are in place for international transfers.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on this page with a new &quot;Last updated&quot; date. Continued use of the Service after changes constitutes acceptance.
      </p>

      <h2>11. Contact Us</h2>
      <p>
        If you have questions about this Privacy Policy, contact us at:
      </p>
      <ul>
        <li>Email: <strong>privacy@lasyly.com</strong></li>
      </ul>

      <div className="mt-12 pt-6 border-t border-[var(--color-border)]">
        <Link href="/terms" className="text-[var(--color-lime)] hover:underline text-sm">
          View Terms of Service →
        </Link>
      </div>
    </article>
  )
}
