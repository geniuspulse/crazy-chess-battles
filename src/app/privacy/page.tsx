import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Crazy Chess Battles",
  description: "How Crazy Chess Battles handles your data",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-ccb-bg text-ccb-text">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link href="/" className="text-ccb-muted hover:text-ccb-primary text-sm mb-8 inline-block">← Back to CCB</Link>
        
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-ccb-muted mb-8">Last updated: August 16, 2026</p>

        <div className="prose prose-invert max-w-none space-y-6 text-sm leading-relaxed text-ccb-muted">
          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">1. Information We Collect</h2>
            <p className="mb-2">When you register, we collect:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Email address (for authentication and notifications)</li>
              <li>Username and display name (visible to other players)</li>
              <li>Phone number (for mobile money deposits and withdrawals)</li>
              <li>Game data (moves, results, ratings, tournament history)</li>
              <li>Payment transaction records (processed by Paychangu)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">2. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide and improve chess gameplay, matchmaking, and tournament features</li>
              <li>To process wallet deposits, entry fees, and withdrawals</li>
              <li>To maintain leaderboards, ratings, and competitive rankings</li>
              <li>To detect and prevent cheating and fraud</li>
              <li>To send essential account notifications (password resets, tournament updates)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">3. Payment Data</h2>
            <p>Payment processing is handled by Paychangu, our payment provider. CCB does not store your card details or mobile money PINs. Transaction records (amount, method, status) are stored for accounting and audit purposes.</p>
          </section>

          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">4. Data Sharing</h2>
            <p>We do not sell your personal data. We share data only with:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Paychangu (for processing payments and withdrawals)</li>
              <li>Supabase (for database hosting and authentication)</li>
              <li>Legal authorities when required by Malawian law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">5. Data Security</h2>
            <p>We use Supabase for secure data storage with row-level security policies. Passwords are hashed by Supabase Auth. Payment data is encrypted in transit via TLS. Access to admin tools is restricted to authorized administrators.</p>
          </section>

          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">6. Your Rights</h2>
            <p>You can request access to your data, correction of inaccurate information, or deletion of your account by contacting us at support@ccb.mw. Note that game records and transaction history may be retained for legal and audit purposes.</p>
          </section>

          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">7. Cookies</h2>
            <p>CCB uses essential cookies for authentication and session management. We use Vercel Analytics for anonymous traffic statistics. We do not use advertising cookies.</p>
          </section>

          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">8. Children's Privacy</h2>
            <p>CCB is not directed at children under 18. We do not knowingly collect data from minors. If you believe a minor has registered, contact us to remove the account.</p>
          </section>

          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">9. Changes to This Policy</h2>
            <p>We may update this Privacy Policy at any time. We will notify users of significant changes via email or in-app notification.</p>
          </section>

          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">10. Contact</h2>
            <p>For privacy questions, contact us at support@ccb.mw</p>
          </section>
        </div>
      </div>
    </div>
  );
}
