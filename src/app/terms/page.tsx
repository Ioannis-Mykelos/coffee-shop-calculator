import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/home/LegalPage";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="28 October 2026">
      <p>
        These terms apply when you use Crema, a service run by [Company legal name], [registered address] (&ldquo;Crema&rdquo;, &ldquo;we&rdquo;). By
        creating an account you accept them.
      </p>
      <h2>The service</h2>
      <p>
        Crema helps you record a café&apos;s monthly costs and work out prices, break-even and profit. Its results are estimates from the figures you
        enter: they are not accounting, tax or financial advice, and you remain responsible for the decisions you make with them.
      </p>
      <h2>Beta</h2>
      <p>
        Crema is free while it is in beta. Features may change. We will give you at least 30 days&apos; notice before introducing any paid plan, and you
        can export your figures or delete your account at any time.
      </p>
      <h2>Your account</h2>
      <ul>
        <li>Give a real email address and keep your password, and any two-step login codes, to yourself.</li>
        <li>You are responsible for what happens in your account. Tell us straight away if you think someone else has used it.</li>
        <li>Don&apos;t misuse the service: no attempts to break in, overload it, or reach other people&apos;s data.</li>
      </ul>
      <h2>Your data</h2>
      <p>
        The figures you enter belong to you. We only use them to run Crema for you, as described in the <Link href="/privacy">Privacy Policy</Link>.
      </p>
      <h2>Ending</h2>
      <p>
        You can delete your account at any time from Account &amp; security. We may suspend an account that breaks these terms, and will tell you why.
      </p>
      <h2>Liability</h2>
      <p>
        We work hard to keep Crema available and your figures safe, but provide the service as it is during beta. [Limitation of liability, to be
        written under the governing law.]
      </p>
      <h2>Contact</h2>
      <p>[Contact email address]</p>
    </LegalPage>
  );
}
