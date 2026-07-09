'use client'

import { useEffect } from 'react'
import { config } from '@/config'

/**
 * Signature — a tasteful styled console greeting crediting RarityScope. Renders nothing.
 * Fires once on mount so anyone who forks or inspects the site knows what powers it.
 */
export function Signature() {
  useEffect(() => {
    const by = config.branding.credit.label ? ` · ${config.branding.credit.label}` : ''
    console.log(
      '%c RarityScope ',
      'background:linear-gradient(90deg,#32e685,#9a52ff);color:#111112;font-weight:700;padding:3px 8px;border-radius:5px;',
    )
    console.log(
      `%cconfig-driven, fork-first NFT rarity — now browsing ${config.displayName}${by}`,
      'color:#6b6b73;font-family:monospace;font-size:11px;',
    )
  }, [])
  return null
}
