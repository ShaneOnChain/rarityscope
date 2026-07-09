import Link from 'next/link'
import { DISPLAY_NAME } from '@/lib/rarity'
import { MethodSwitcher } from './MethodSwitcher'

/** Sticky top bar — collection text lockup home link + method switcher + primary nav. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-surface-3 bg-dark/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 sm:h-14 sm:flex-nowrap sm:py-0">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="font-display text-base font-bold text-accent">{DISPLAY_NAME}</span>
          <span className="font-mono text-sm text-text-muted">rarity</span>
        </Link>

        <div className="order-last flex w-full items-center justify-between gap-3 sm:order-none sm:w-auto sm:gap-4">
          <MethodSwitcher />
          <nav className="flex items-center gap-4 font-display text-sm">
            <Link href="/" className="text-text-secondary hover:text-text-primary">
              browse
            </Link>
            <Link href="/compare" className="text-text-secondary hover:text-text-primary">
              compare
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
