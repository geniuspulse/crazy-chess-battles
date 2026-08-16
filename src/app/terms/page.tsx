import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Crazy Chess Battles",
  description: "Terms and conditions for using Crazy Chess Battles",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-ccb-bg text-ccb-text">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link href="/" className="text-ccb-muted hover:text-ccb-primary text-sm mb-8 inline-block">← Back to CCB</Link>
        
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-ccb-muted mb-8">Last updated: August 16, 2026</p>

        <div className="prose prose-invert max-w-none space-y-6 text-sm leading-relaxed text-ccb-muted">
          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">1. Acceptance of Terms</h2>
            <p>By creating an account or using Crazy Chess Battles ("CCB", "we", "us"), you agree to these Terms of Service. If you do not agree, do not use the platform.</p>
          </section>

          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">2. Eligibility</h2>
            <p>You must be at least 18 years old to create an account. By using CCB, you confirm you are of legal age in Malawi. Players under 18 are not permitted to participate in paid tournaments or handle real money on the platform.</p>
          </section>

          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">3. Account Registration</h2>
            <p>You must provide accurate information when registering. You are responsible for maintaining the security of your account and password. CCB is not liable for unauthorized access to your account.</p>
          </section>

          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">4. Wallet, Deposits, and Withdrawals</h2>
            <p className="mb-2">CCB uses Paychangu to process mobile money and card payments for wallet deposits and withdrawals.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Deposits are credited to your CCB wallet after payment confirmation.</li>
              <li>Entry fees for paid tournaments are debited from your wallet at registration.</li>
              <li>Withdrawals are processed to your mobile money account within 24 hours of admin approval.</li>
              <li>Minimum withdrawal amount is MWK 10.</li>
              <li>CCB reserves the right to reject withdrawal requests suspected of fraud or violation of these Terms.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">5. Tournaments and Prize Pools</h2>
            <p className="mb-2">CCB hosts competitive chess tournaments with optional entry fees and prize pools.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Entry fees are collected into a tournament prize pool before the tournament starts.</li>
              <li>Prize distribution follows the published breakdown for each tournament (default: 50% for 1st, 30% for 2nd, 20% for 3rd).</li>
              <li>If a tournament is cancelled, all entry fees are refunded to participants' wallets.</li>
              <li>Players who leave a tournament after it starts forfeit their entry fee.</li>
              <li>Prize winnings are credited to your wallet and can be withdrawn via mobile money.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">6. Fair Play and Anti-Cheat</h2>
            <p>Cheating, including but not limited to using chess engines, receiving outside assistance, or colluding with other players, is strictly prohibited. Violators will be permanently banned, their accounts frozen, and prize winnings forfeited.</p>
          </section>

          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">7. Prohibited Conduct</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Creating multiple accounts to manipulate ratings or tournaments</li>
              <li>Harassing or abusing other players verbally or in chat</li>
              <li>Attempting to exploit bugs or vulnerabilities in the platform</li>
              <li>Using bots or automated tools to play games</li>
            </ul>
          </section>

          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">8. Limitation of Liability</h2>
            <p>CCB is provided "as is" without warranties of any kind. We are not liable for losses resulting from service interruptions, payment processing delays, or circumstances beyond our control. Our maximum liability for any claim is limited to the amount in your CCB wallet.</p>
          </section>

          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">9. Changes to Terms</h2>
            <p>We may update these Terms at any time. Continued use of CCB after changes constitutes acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">10. Governing Law</h2>
            <p>These Terms are governed by the laws of the Republic of Malawi. Any disputes shall be resolved in the courts of Malawi.</p>
          </section>

          <section>
            <h2 className="text-ccb-text font-semibold text-lg mb-2">11. Contact</h2>
            <p>For questions about these Terms, contact us at support@ccb.mw</p>
          </section>
        </div>
      </div>
    </div>
  );
}
