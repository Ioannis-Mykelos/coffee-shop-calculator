import Image from "next/image"
import Link from "next/link"

import { CremaLogo } from "@/components/brand/Logo"
import cafe from "../../../public/home/cafe.jpg"

/**
 * The frame for logging in and the email-link pages: the café on the left (wide screens only), the form on the right.
 * A Server Component; what goes inside may be interactive.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-cream text-espresso lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden lg:block">
        <Image src={cafe} alt="" fill priority sizes="55vw" placeholder="blur" className="object-cover object-[62%_50%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-espresso/85 via-espresso/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 p-12 text-cream">
          <p className="m-0 max-w-[460px] font-serif text-[34px] leading-[1.12] font-medium tracking-[-0.015em]">
            &ldquo;The best cafés aren&apos;t only good at coffee. They know their numbers.&rdquo;
          </p>
          <span className="text-sm text-cream/75">Crema · The numbers behind every cup</span>
        </div>
      </aside>
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Link href="/" aria-label="Crema home" className="w-fit rounded-lg">
          <CremaLogo />
        </Link>
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[420px]">{children}</div>
        </main>
        <p className="m-0 text-center text-[13px] text-espresso/55">
          <Link href="/terms" className="text-espresso/65">Terms</Link> · <Link href="/privacy" className="text-espresso/65">Privacy</Link> · ©{" "}
          {new Date().getFullYear()} Crema
        </p>
      </div>
    </div>
  )
}

/** A short message page inside the frame: a result, with what to do next. */
export function AuthMessage({ icon, title, children, actions }: { icon: React.ReactNode; title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <AuthShell>
      <section aria-labelledby="message-title" className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-oak text-espresso">{icon}</span>
        <h1 id="message-title" className="m-0 font-serif text-[32px] leading-tight font-medium tracking-[-0.015em]">
          {title}
        </h1>
        <div className="text-[15px] leading-relaxed text-espresso/75">{children}</div>
        {actions && <div className="mt-2 flex flex-wrap justify-center gap-3">{actions}</div>}
      </section>
    </AuthShell>
  )
}

/** The pill-shaped buttons of the auth pages, as links. */
export const authButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold no-underline transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
export const authPrimary = `${authButton} bg-espresso text-cream hover:bg-espresso-2 hover:text-cream`
export const authSecondary = `${authButton} border border-espresso/20 bg-white text-espresso hover:bg-oak/40 hover:text-espresso`
