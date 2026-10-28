import type { Metadata } from "next";
import { LegalPage } from "@/components/home/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="28 October 2026">
      <p>
        This policy explains what [Company legal name] (&ldquo;Crema&rdquo;) keeps about you, why, and what you can do about it. Crema is the data
        controller.
      </p>
      <h2>What we keep</h2>
      <ul>
        <li>Your account: name, email address, and when you joined. If you use Google, the link to your Google account.</li>
        <li>Your password as a bcrypt hash, never as typed. If you turn on two-step login, its secret (encrypted) and your recovery codes (as hashes).</li>
        <li>The figures you enter: costs, staff, prices, sales, and your currency and country choices.</li>
        <li>Short-lived security data: counts of log-in attempts per IP address and email address, kept for 15 minutes to an hour.</li>
      </ul>
      <h2>What we use it for</h2>
      <p>
        Only to run Crema for you: to log you in, keep your figures, and send account emails (confirming your address, resetting a password, security
        notices). We don&apos;t sell your data, show ads, or share it with anyone except the providers below.
      </p>
      <h2>Your location</h2>
      <p>
        To pick your currency, Crema looks up the country (and city) of your IP address through our hosting provider when you open the calculator. It
        isn&apos;t stored; only the currency and any country you choose by hand are kept with your figures.
      </p>
      <h2>Who processes it</h2>
      <ul>
        <li>Netlify (hosting)</li>
        <li>MongoDB Atlas (database, encrypted at rest)</li>
        <li>Google, only if you sign in with Google</li>
        <li>[Email provider] (account emails)</li>
      </ul>
      <h2>How long</h2>
      <p>As long as you have an account. Deleting your account deletes it and every figure in it straight away.</p>
      <h2>Your rights</h2>
      <p>
        You can see, correct, export (Export month includes your full history) and delete your data at any time. For anything else, or to complain,
        contact us at [contact email address]. You can also complain to [data protection authority].
      </p>
    </LegalPage>
  );
}
