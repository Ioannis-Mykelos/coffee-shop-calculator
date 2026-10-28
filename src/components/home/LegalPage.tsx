import Link from "next/link"

import { CremaLogo } from "@/components/brand/Logo"

/**
 * A legal document page. The texts are drafts: they describe what Crema actually does, and [bracketed] values are
 * placeholders for the company's details. Have a lawyer review them before launch.
 */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream text-espresso">
      <header className="border-b border-espresso/10">
        <div className="mx-auto flex h-[68px] max-w-[760px] items-center px-5 sm:px-8">
          <Link href="/" aria-label="Crema home" className="rounded-lg">
            <CremaLogo />
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-[760px] flex-col gap-6 px-5 py-14 sm:px-8">
        <p className="m-0 w-fit rounded-full bg-oak px-3 py-1 text-[13px] font-medium">Draft · to be reviewed before launch</p>
        <h1 className="m-0 font-serif text-[44px] leading-tight font-medium tracking-[-0.02em]">{title}</h1>
        <p className="m-0 text-sm text-espresso/60">Last updated {updated}</p>
        <div className="flex flex-col gap-5 text-[16px] leading-relaxed text-espresso/85 [&_h2]:m-0 [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-espresso [&_p]:m-0 [&_ul]:m-0 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5">
          {children}
        </div>
      </main>
    </div>
  )
}
