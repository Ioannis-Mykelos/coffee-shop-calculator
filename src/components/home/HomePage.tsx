import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  CalendarRange,
  Check,
  ChartNoAxesCombined,
  Coffee,
  FileSpreadsheet,
  Globe,
  KeyRound,
  LockKeyhole,
  Receipt,
  Scale,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react"

import { CremaLogo } from "@/components/brand/Logo"
import { CATEGORIES, breakEven, computeTotals, cupCost, priceFormatter, sampleMonth, currencyFormatter } from "@/lib/expenses"
import { cn } from "@/lib/utils"
import cafe from "../../../public/home/cafe.jpg"
import menuBoard from "../../../public/home/menu-board.jpg"
import sign from "../../../public/home/sign.jpg"

// The home page: who Crema is and what it does, for an independent café owner deciding whether to try it. A Server
// Component with no JavaScript of its own. The figures shown are worked out by the app's own sums (lib/expenses.ts)
// from its sample café, so the page never shows a number the product wouldn't.

const SAMPLE = sampleMonth()
const TOTALS = computeTotals(SAMPLE)
const CUP = cupCost(SAMPLE)
const BREAK_EVEN = breakEven(SAMPLE, TOTALS.total)
const price = priceFormatter("EUR")
const money = currencyFormatter("EUR")

/** Where a call to action goes: sign up when accounts are on; straight to the calculator when they aren't. */
export interface HomeLinks {
  start: string
  login: string | null
  /** Signed in already: the button opens Crema instead */
  signedIn: boolean
}

const cta =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold no-underline transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
const ctaDark = cn(cta, "bg-espresso text-cream hover:bg-espresso-2 hover:text-cream")
const ctaLight = cn(cta, "border border-espresso/20 bg-white/70 text-espresso hover:bg-white hover:text-espresso")

export function HomePage({ links }: { links: HomeLinks }) {
  const startLabel = links.signedIn ? "Open Crema" : "Start free"
  return (
    <div className="bg-cream text-espresso">
      <Nav links={links} startLabel={startLabel} />
      <main>
        <Hero links={links} startLabel={startLabel} />
        <Facts />
        <Story />
        <Features />
        <HowItWorks />
        <Preview />
        <Security />
        <Company />
        <Faq />
        <FinalCta links={links} startLabel={startLabel} />
      </main>
      <Footer links={links} />
    </div>
  )
}

function Nav({ links, startLabel }: { links: HomeLinks; startLabel: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-espresso/10 bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" aria-label="Crema home" className="rounded-lg">
          <CremaLogo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-7 text-[15px] md:flex">
          {[
            ["Product", "#product"],
            ["How it works", "#how"],
            ["Security", "#security"],
            ["About", "#about"],
            ["FAQ", "#faq"],
          ].map(([label, href]) => (
            <a key={href} href={href} className="text-espresso/75 no-underline hover:text-espresso">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          {links.login && !links.signedIn && (
            <Link href={links.login} className="rounded-full px-3 py-2 text-[15px] font-semibold text-espresso no-underline hover:text-espresso-2">
              Log in
            </Link>
          )}
          <Link href={links.start} className={cn(ctaDark, "min-h-10 px-5 text-sm")}>
            {startLabel}
          </Link>
        </div>
      </div>
    </header>
  )
}

function Hero({ links, startLabel }: { links: HomeLinks; startLabel: string }) {
  return (
    <section aria-labelledby="hero-title" className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 pt-14 pb-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:pt-20">
      <div className="flex flex-col gap-7">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-espresso/15 bg-white/60 px-3.5 py-1.5 text-[13px] font-medium text-espresso/80">
          <Coffee aria-hidden="true" className="size-4 text-brand" />
          For independent cafés · Free during beta
        </span>
        <h1 id="hero-title" className="m-0 font-serif text-[44px] leading-[1.02] font-medium tracking-[-0.025em] sm:text-[60px] lg:text-[68px]">
          Know what every cup <em className="font-normal text-brand">really</em> costs.
        </h1>
        <p className="m-0 max-w-[520px] text-lg leading-relaxed text-espresso/75">
          Crema turns your rent, beans, milk and wages into the numbers that decide your month: the price of a cup, the customers you need each
          day, and what&apos;s left when the bills are paid.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={links.start} className={ctaDark}>
            {startLabel}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <a href="#how" className={ctaLight}>
            See how it works
          </a>
        </div>
        <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-sm text-espresso/70">
          {["No card needed", "Two-step login", "Export to Excel any time"].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <Check aria-hidden="true" className="size-4 text-good" />
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative">
        <div className="overflow-hidden rounded-[28px] shadow-[0_30px_80px_-30px_rgba(42,29,22,0.45)]">
          <Image
            src={cafe}
            alt="A bright Nordic café: oak counter, an espresso machine and a barista under a Crema sign, tables by tall windows"
            priority
            placeholder="blur"
            sizes="(min-width: 1024px) 620px, 100vw"
            className="h-auto w-full"
          />
        </div>
        <CupReceipt className="absolute -bottom-10 left-3 w-[250px] sm:left-6 sm:w-[270px]" />
        <div className="absolute top-5 right-5 hidden rounded-2xl bg-white/92 px-4 py-3 shadow-[0_12px_32px_-12px_rgba(42,29,22,0.35)] backdrop-blur sm:block">
          <div className="text-xs font-medium tracking-[0.06em] text-espresso/60 uppercase">To break even</div>
          <div className="font-display text-2xl font-semibold">
            {BREAK_EVEN.customersDay} <span className="text-base font-medium text-espresso/70">customers a day</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/** One cup, priced the way Crema prices it: the recipe from the supplies, then margin and VAT. */
function CupReceipt({ className }: { className?: string }) {
  return (
    <figure
      aria-label="Example: the cost and price of one cup"
      className={cn("m-0 rounded-2xl bg-white p-4 font-mono text-[13px] shadow-[0_18px_40px_-14px_rgba(42,29,22,0.4)]", className)}
    >
      <figcaption className="mb-2.5 flex items-center gap-2 font-sans text-[13px] font-semibold">
        <Receipt aria-hidden="true" className="size-4 text-brand" />
        One flat white
      </figcaption>
      <dl className="m-0 flex flex-col gap-1.5">
        {CUP.lines.map((l) => (
          <div key={l.id} className="flex justify-between gap-3 text-espresso/75">
            <dt>{l.supply?.label}</dt>
            <dd className="m-0">{price(l.cost)}</dd>
          </div>
        ))}
        <div className="mt-1 flex justify-between gap-3 border-t border-dashed border-espresso/20 pt-2">
          <dt>Cost</dt>
          <dd className="m-0">{price(CUP.ingredients)}</dd>
        </div>
        <div className="flex justify-between gap-3 rounded-lg bg-brand-soft px-2 py-1.5 font-semibold text-brand-strong">
          <dt>Price incl. VAT</dt>
          <dd className="m-0">{price(CUP.priceInclVat)}</dd>
        </div>
      </dl>
    </figure>
  )
}

function Facts() {
  const facts = [
    ["6", "cost categories, from rent to pastries"],
    ["1 cup", "priced from its real recipe"],
    ["12", "months, quarters or years compared"],
    ["70+", "currencies, picked from where you are"],
  ]
  return (
    <section aria-label="Crema at a glance" className="border-y border-espresso/10 bg-white/50">
      <ul className="mx-auto grid max-w-[1200px] list-none grid-cols-2 gap-6 px-5 py-9 sm:px-8 lg:grid-cols-4">
        {facts.map(([n, t]) => (
          <li key={t} className="flex flex-col gap-1">
            <span className="font-serif text-[34px] leading-none font-medium">{n}</span>
            <span className="text-sm text-espresso/70">{t}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function SectionHead({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex max-w-[680px] flex-col gap-4">
      <span className="text-[13px] font-semibold tracking-[0.12em] text-brand uppercase">{eyebrow}</span>
      <h2 id={id} className="m-0 font-serif text-[36px] leading-[1.08] font-medium tracking-[-0.02em] sm:text-[44px]">
        {title}
      </h2>
      {children && <p className="m-0 text-lg leading-relaxed text-espresso/75">{children}</p>}
    </div>
  )
}

function Story() {
  return (
    <section aria-labelledby="story-title" className="mx-auto flex max-w-[1200px] flex-col gap-12 px-5 py-24 sm:px-8">
      <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <SectionHead id="story-title" eyebrow="Why Crema" title={<>Great coffee. Thin margins.</>} />
        <div className="flex flex-col gap-5 text-[17px] leading-relaxed text-espresso/80">
          <p className="m-0">
            Rent goes up. Oat milk goes up. A part-timer picks up extra shifts. Most café owners find out what it all added up to when the month is
            already over, in a spreadsheet nobody enjoys opening.
          </p>
          <p className="m-0">
            Crema shows you while there&apos;s still time to act: what a cup costs you today, whether the price on the board still covers it, and how
            many customers a day keep the doors open. Plain words, real numbers, no accounting degree needed.
          </p>
        </div>
      </div>
      <figure className="m-0 overflow-hidden rounded-[28px] shadow-[0_30px_80px_-40px_rgba(42,29,22,0.45)]">
        <Image
          src={menuBoard}
          alt="The Crema Cost Planner sign above a café menu board: espresso 2.8, latte 4.5, cappuccino 4.2, flat white 4.0, drip 2.5"
          placeholder="blur"
          sizes="(min-width: 1200px) 1136px, 100vw"
          className="h-auto max-h-[560px] w-full object-cover object-top"
        />
      </figure>
    </section>
  )
}

const FEATURES = [
  {
    icon: CalendarRange,
    title: "Every cost, one month at a time",
    text: "Rent, utilities, supplies, food you buy in, staff and the rest, in six simple tabs. Each new month starts as a copy of the last, so you only change what changed.",
  },
  {
    icon: Coffee,
    title: "The true cost of a cup",
    text: "Build a cup from your own supplies (beans, milk, cup and lid) and see its cost, your margin and the price with VAT.",
  },
  {
    icon: Users,
    title: "Staff, made simple",
    text: "Full-time and part-time rows with hours, hourly pay and contributions. Head count and hours add themselves up.",
  },
  {
    icon: Scale,
    title: "Break-even and profit",
    text: "Customers needed per day, based on what a customer really spends. Type in the month's takings to see the profit or loss.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Months, quarters, years",
    text: "Compare any period with the one before, see your biggest cost, and spot the month things changed.",
  },
  {
    icon: FileSpreadsheet,
    title: "Excel in one click",
    text: "A real workbook for your accountant: summary, expenses, staff and the full history, with money formatted properly.",
  },
]

function Features() {
  return (
    <section id="product" aria-labelledby="product-title" className="scroll-mt-20 bg-white/55 py-24">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-14 px-5 sm:px-8">
        <SectionHead id="product-title" eyebrow="The product" title="Everything a café owner checks, nothing they don't.">
          Crema is built around the questions you actually ask: what does this month cost, what should a cup sell for, and are we making money?
        </SectionHead>
        <ul className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex flex-col gap-3 rounded-[22px] border border-espresso/10 bg-cream p-6">
              <span className="flex size-11 items-center justify-center rounded-xl bg-oak text-espresso">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <h3 className="m-0 font-display text-lg font-semibold">{title}</h3>
              <p className="m-0 leading-relaxed text-espresso/75">{text}</p>
            </li>
          ))}
          <li className="flex flex-col gap-3 rounded-[22px] border border-espresso/10 bg-cream p-6 sm:col-span-2 lg:col-span-3 lg:flex-row lg:items-center lg:gap-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-oak text-espresso">
              <Globe aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h3 className="m-0 font-display text-lg font-semibold">Your country, your currency</h3>
              <p className="m-0 leading-relaxed text-espresso/75">
                Crema sees where you are and picks your currency: kroner in Copenhagen, euros in Lisbon, pounds in Bristol. Change it any time.
              </p>
            </div>
          </li>
        </ul>
      </div>
    </section>
  )
}

const STEPS = [
  ["Enter this month's costs", "Type in rent, bills, supplies and staff. Start from our sample café and replace its figures with yours."],
  ["Build your cup", "Pick what goes into one coffee from your supplies, set your margin and VAT, and get a price that covers it."],
  ["Watch the numbers", "See the customers you need each day and, once you add the takings, the month's profit. Next month starts as a copy."],
]

function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="mx-auto flex max-w-[1200px] scroll-mt-20 flex-col gap-14 px-5 py-24 sm:px-8">
      <SectionHead id="how-title" eyebrow="How it works" title="Ten minutes a month." />
      <ol className="m-0 grid list-none gap-5 p-0 md:grid-cols-3">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="relative flex flex-col gap-3 border-t-2 border-espresso pt-6">
            <span className="font-serif text-5xl leading-none font-medium text-brand">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="m-0 font-display text-xl font-semibold">{title}</h3>
            <p className="m-0 leading-relaxed text-espresso/75">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** A still of the calculator's summary, drawn from the sample café's real totals. */
function Preview() {
  const cats = CATEGORIES.map((c) => ({ ...c, value: TOTALS[c.key], pct: (TOTALS[c.key] / TOTALS.total) * 100 }))
  return (
    <section aria-labelledby="preview-title" className="bg-espresso py-24 text-cream">
      <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-5">
          <span className="text-[13px] font-semibold tracking-[0.12em] text-crema uppercase">Inside Crema</span>
          <h2 id="preview-title" className="m-0 font-serif text-[36px] leading-[1.08] font-medium tracking-[-0.02em] text-cream sm:text-[44px]">
            Your month on one calm screen.
          </h2>
          <p className="m-0 text-lg leading-relaxed text-cream/75">
            The total, where the money goes, and the one number to watch each day. This is the sample café every new account starts with; replace its
            figures with yours.
          </p>
        </div>
        <div aria-label="Example month in Crema" role="img" className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 rounded-2xl bg-cream/[0.07] p-6 ring-1 ring-cream/10 sm:col-span-2">
            <span className="text-xs tracking-[0.08em] text-cream/60 uppercase">Estimated expenses · this month</span>
            <span className="font-display text-[44px] font-semibold tracking-[-0.02em]">{money(TOTALS.total)}</span>
            <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-cream/10">
              {cats.map((c) => (
                <span key={c.key} className="h-3" style={{ width: `${c.pct}%`, background: c.color }} />
              ))}
            </div>
            <ul className="m-0 mt-3 grid list-none grid-cols-2 gap-x-6 gap-y-1.5 p-0 text-sm sm:grid-cols-3">
              {cats.map((c) => (
                <li key={c.key} className="flex items-center gap-2 text-cream/80">
                  <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: c.color }} />
                  {c.label}
                  <span className="ml-auto font-mono text-cream/60">{Math.round(c.pct)}%</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl bg-crema p-6 text-espresso">
            <span className="text-xs font-semibold tracking-[0.08em] uppercase opacity-70">Customers needed per day</span>
            <span className="font-display text-[40px] font-semibold">{BREAK_EVEN.customersDay}</span>
            <span className="text-sm opacity-75">at {price(BREAK_EVEN.avgGross)} per customer, {BREAK_EVEN.days} days open</span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl bg-cream p-6 text-espresso">
            <span className="text-xs font-semibold tracking-[0.08em] uppercase opacity-70">Price of a cup</span>
            <span className="font-display text-[40px] font-semibold">{price(CUP.priceInclVat)}</span>
            <span className="text-sm opacity-75">costs {price(CUP.ingredients)} to make, VAT included</span>
          </div>
        </div>
      </div>
    </section>
  )
}

const SECURITY = [
  { icon: KeyRound, title: "Two-step login", text: "Add a code from Google or Microsoft Authenticator, 1Password or Authy, with recovery codes for a lost phone." },
  { icon: ShieldCheck, title: "Google or email", text: "Sign in with Google, or with an email and password. Passwords are hashed with bcrypt and never stored as typed." },
  { icon: LockKeyhole, title: "Private by default", text: "Your figures belong to your account alone, travel over HTTPS, and are encrypted at rest in the database." },
  { icon: Trash2, title: "Leave any time", text: "Export everything to Excel, and delete your account with all its figures in one step." },
]

function Security() {
  return (
    <section id="security" aria-labelledby="security-title" className="mx-auto flex max-w-[1200px] scroll-mt-20 flex-col gap-14 px-5 py-24 sm:px-8">
      <SectionHead id="security-title" eyebrow="Security" title="Your numbers stay yours.">
        A café&apos;s books are personal. Crema guards them with a strong login, and never sells or shares them.
      </SectionHead>
      <ul className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {SECURITY.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex flex-col gap-3 rounded-[22px] bg-white p-6 shadow-[0_1px_0_rgba(42,29,22,0.06)] ring-1 ring-espresso/8">
            <Icon aria-hidden="true" className="size-6 text-brand" />
            <h3 className="m-0 font-display text-lg font-semibold">{title}</h3>
            <p className="m-0 text-[15px] leading-relaxed text-espresso/75">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Company() {
  return (
    <section id="about" aria-labelledby="about-title" className="scroll-mt-20 bg-oak/60">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-8">
          <SectionHead id="about-title" eyebrow="About us" title="A small company for small cafés.">
            Crema is a young company building calm, honest software for independent coffee shops. We start with the numbers, because they decide
            whether a good café gets to stay open, and we&apos;re building the rest with the owners who use it.
          </SectionHead>
          <Image
            src={sign}
            alt="The Crema Cost Planner logo, lit up on a café wall"
            placeholder="blur"
            sizes="(min-width: 1024px) 560px, 100vw"
            className="h-auto w-full rounded-[24px]"
          />
        </div>
        <div className="flex flex-col gap-4 rounded-[26px] bg-cream p-8">
          <h3 className="m-0 font-display text-lg font-semibold">What we believe</h3>
          <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[15px] leading-relaxed text-espresso/80">
            {[
              "Owners should understand their numbers without hiring someone to explain them.",
              "Software for a small business should be quick to learn and quiet to use.",
              "Your data is yours: easy to export, easy to delete, never sold.",
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-brand" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

const FAQ = [
  ["Is Crema free?", "Yes, while Crema is in beta. We'll give you plenty of notice before any paid plan, and your figures stay yours to export either way."],
  [
    "Do I need to be good with spreadsheets?",
    "No. If you know what you pay in rent and what a bag of beans costs, you have everything Crema needs. It does the sums.",
  ],
  ["Which currencies does it support?", "More than seventy. Crema picks yours from where you are, and you can change it whenever you like."],
  ["Can I use it on my phone?", "Yes. Crema works in any modern browser on a phone, tablet or computer, and your figures follow you between them."],
  ["How do I get my data out?", "Export any month to an Excel workbook in one click. It includes the full history of every month you've entered."],
  ["Can I delete my account?", "Any time, from Account & security. It deletes your account and every figure in it."],
]

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="mx-auto grid max-w-[1200px] scroll-mt-20 gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <SectionHead id="faq-title" eyebrow="FAQ" title="Questions, answered." />
      <div className="flex flex-col">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group border-b border-espresso/15 py-5 first:border-t">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md font-display text-lg font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
              {q}
              <span aria-hidden="true" className="text-2xl leading-none font-normal text-brand transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="m-0 mt-3 max-w-[620px] leading-relaxed text-espresso/75">{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function FinalCta({ links, startLabel }: { links: HomeLinks; startLabel: string }) {
  return (
    <section aria-labelledby="cta-title" className="px-5 pb-24 sm:px-8">
      <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[32px]">
        <Image src={cafe} alt="" fill sizes="(min-width: 1200px) 1200px, 100vw" className="object-cover object-[70%_50%]" />
        <div className="absolute inset-0 bg-gradient-to-r from-espresso/92 via-espresso/75 to-espresso/30" />
        <div className="relative flex max-w-[560px] flex-col gap-6 p-10 sm:p-14">
          <h2 id="cta-title" className="m-0 font-serif text-[38px] leading-[1.06] font-medium tracking-[-0.02em] text-cream sm:text-[48px]">
            Open the books on your café.
          </h2>
          <p className="m-0 text-lg text-cream/80">Set up your first month over a coffee. Free while we&apos;re in beta.</p>
          <Link href={links.start} className={cn(cta, "w-fit bg-crema text-espresso hover:bg-cream hover:text-espresso")}>
            {startLabel}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

function Footer({ links }: { links: HomeLinks }) {
  return (
    <footer className="border-t border-espresso/10">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-[320px] flex-col gap-3">
          <CremaLogo />
          <p className="m-0 text-sm text-espresso/65">The numbers behind every cup. Made for independent cafés.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-14 gap-y-2.5 text-[15px] sm:grid-cols-3">
          <a href="#product" className="text-espresso/75 no-underline hover:text-espresso">Product</a>
          <a href="#security" className="text-espresso/75 no-underline hover:text-espresso">Security</a>
          <a href="#faq" className="text-espresso/75 no-underline hover:text-espresso">FAQ</a>
          {links.login && (
            <Link href={links.login} className="text-espresso/75 no-underline hover:text-espresso">Log in</Link>
          )}
          <Link href="/terms" className="text-espresso/75 no-underline hover:text-espresso">Terms</Link>
          <Link href="/privacy" className="text-espresso/75 no-underline hover:text-espresso">Privacy</Link>
        </nav>
      </div>
      <div className="mx-auto max-w-[1200px] px-5 pb-10 text-[13px] text-espresso/55 sm:px-8">© {new Date().getFullYear()} Crema. All rights reserved.</div>
    </footer>
  )
}
