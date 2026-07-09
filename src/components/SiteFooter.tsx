import { DISPLAY_NAME, METHODS, METHOD_META } from '@/lib/rarity'
import { config } from '@/config'

/** Footer — methodology pointer + credit + the same disclaimer the Discord card carries. */
export function SiteFooter() {
  const { credit } = config.branding
  const methodNames = METHODS.map((m) => METHOD_META[m].label).join(' · ')

  return (
    <footer className="mx-auto mt-16 max-w-5xl px-4 pb-10 pt-8">
      <div className="border-t border-surface-3 pt-6 text-sm text-text-muted">
        <p>
          ranked by{' '}
          <span className="text-text-secondary">{methodNames}</span>{' '}
          · art &amp; listings via{' '}
          <a
            href={config.marketplace.collectionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary hover:text-text-primary"
          >
            {config.marketplace.name}
          </a>
          {credit.label && (
            <>
              {' '}· built by{' '}
              <a
                href={credit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-secondary hover:text-text-primary"
              >
                {credit.label}
              </a>
            </>
          )}
        </p>
        <p className="mt-2">
          {DISPLAY_NAME} itself publishes no rarity — these ranks are computed independently. Not financial advice.
        </p>
        <p className="mt-2 font-mono text-xs text-text-muted">rarity engine · RarityScope</p>
      </div>
    </footer>
  )
}
