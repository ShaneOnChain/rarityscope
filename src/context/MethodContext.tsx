'use client'

/**
 * MethodContext — the active rarity method (openRarity / rarityScore / infoContent), shared across
 * the whole app. Persisted to localStorage and reflected in the URL (?m=…) so a chosen view is both
 * sticky and shareable. Server renders the config default; the stored/URL preference is applied on
 * mount (no hydration mismatch, since both start from the default).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { config } from '@/config'
import type { RarityMethod } from '@/config'

const METHODS = config.rarity.enabledMethods
const DEFAULT = config.rarity.defaultMethod
const STORAGE_KEY = 'rarityscope:method'

const isMethod = (v: string | null): v is RarityMethod => !!v && (METHODS as string[]).includes(v)

type Ctx = { method: RarityMethod; setMethod: (m: RarityMethod) => void; methods: RarityMethod[] }
const MethodCtx = createContext<Ctx | null>(null)

function readInitial(): RarityMethod {
  if (typeof window === 'undefined') return DEFAULT
  const fromUrl = new URLSearchParams(window.location.search).get('m')
  if (isMethod(fromUrl)) return fromUrl
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (isMethod(stored)) return stored
  return DEFAULT
}

export function MethodProvider({ children }: { children: ReactNode }) {
  const [method, setMethodState] = useState<RarityMethod>(DEFAULT)

  useEffect(() => {
    setMethodState(readInitial())
  }, [])

  const setMethod = (m: RarityMethod) => {
    setMethodState(m)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, m)
      const url = new URL(window.location.href)
      url.searchParams.set('m', m)
      window.history.replaceState(null, '', url)
    }
  }

  return <MethodCtx.Provider value={{ method, setMethod, methods: METHODS }}>{children}</MethodCtx.Provider>
}

export function useMethod(): Ctx {
  const ctx = useContext(MethodCtx)
  if (!ctx) throw new Error('useMethod must be used within <MethodProvider>')
  return ctx
}
