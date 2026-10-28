import { cn } from "@/lib/utils"

/**
 * Crema's mark: a cup whose rim opens for a rising arrow, with a wisp of steam. Drawn from the brand's sign as lines
 * on a 64-unit grid, in the logo gold (--logo), so it stays sharp from a favicon (app/icon.svg) to a hero.
 */
export function CremaMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={4.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-10 shrink-0 text-logo", className)}
    >
      <path d="M25 21.6C15.5 22.6 8.6 26.4 8.6 31.6C8.6 44 18 53.4 29.5 53.4S50.2 44.6 50.2 33.4" />
      <path d="M11.6 35c8 3.9 27.2 4.2 36.6-.9c3.2-1.9 3.6-5.1.4-7.7" />
      <path d="M50.2 35.6c5.6-1.7 9.4 1.5 8.4 5.8-.9 3.6-5 5.3-10.4 4.6" />
      <path d="M17.2 37.4L29.4 23l6.6 7.6 13.4-13.8" />
      <path d="M55.6 10.6L44 13.2l9.8 9.6z" fill="currentColor" strokeWidth={1.5} />
      <path d="M35.6 3.6c-3.2 2.3-1.2 4.4.8 6.4 1.9 1.9 1.4 4.4-1.4 6.2" strokeWidth={2.8} />
    </svg>
  )
}

/**
 * The mark and the name, as on the sign: CREMA, with COST PLANNER under it unless `compact`. `inverted` is for dark
 * backgrounds.
 */
export function CremaLogo({ className, compact = false, inverted = false }: { className?: string; compact?: boolean; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <CremaMark className={inverted ? "text-crema" : undefined} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-brand text-[21px] font-semibold tracking-[0.08em]", inverted ? "text-cream" : "text-espresso")}>CREMA</span>
        {!compact && (
          <span className={cn("mt-1 font-brand text-[9.5px] font-medium tracking-[0.2em]", inverted ? "text-cream/70" : "text-espresso/60")}>
            COST PLANNER
          </span>
        )}
      </span>
    </span>
  )
}
