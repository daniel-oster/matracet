// Läget's colour theme: one of a few fixed sets, chosen per device and kept in localStorage (it is a
// taste of this phone, not household data, so it isn't synced). Applied as <html data-laget-theme>;
// the colours themselves live in themes.css.

export const THEMES = [
  { id: 'papper', namn: 'Papper', beskrivning: 'Krämfärgat papper, som Matracet', swatch: ['#f7f4ef', '#1a1a1a', '#c8a96e'] },
  { id: 'solarized-ljus', namn: 'Solarized ljus', beskrivning: 'Mjukt gult, blågrön text', swatch: ['#fdf6e3', '#073642', '#b58900'] },
  { id: 'solarized-mork', namn: 'Solarized mörk', beskrivning: 'Djupt blågrönt, varm text', swatch: ['#002b36', '#eee8d5', '#268bd2'] },
  { id: 'neon', namn: 'Neon', beskrivning: 'Nästan svart med cyan och magenta', swatch: ['#0a0014', '#00f0ff', '#ff3df0'] },
  { id: 'rymd', namn: 'Rymd', beskrivning: 'Natthimlen över Hermanus bakom allt', swatch: ['#01020a', '#9db4ff', '#ffc27a'] },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

const KEY = 'laget:theme:v1'
export const DEFAULT_THEME: ThemeId = 'papper'

/** A stored value back to a theme id; anything unknown (an old or edited value) is the default. */
export function parseTheme(value: unknown): ThemeId {
  return THEMES.find(t => t.id === value)?.id ?? DEFAULT_THEME
}

export function getTheme(): ThemeId {
  try {
    return parseTheme(localStorage.getItem(KEY))
  } catch {
    return DEFAULT_THEME
  }
}

export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.lagetTheme = id
  // iOS paints the status bar from this when the app is on the home screen in some modes.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[id])
}

const listeners = new Set<() => void>()

/** For useSyncExternalStore: lets the app react when the theme is changed from the picker. */
export function subscribeTheme(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function setTheme(id: ThemeId): void {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // Private mode or blocked storage: the theme still applies for this visit.
  }
  applyTheme(id)
  listeners.forEach(cb => cb())
}

const THEME_COLOR: Record<ThemeId, string> = {
  papper: '#12303f',
  'solarized-ljus': '#fdf6e3',
  'solarized-mork': '#002b36',
  neon: '#0a0014',
  rymd: '#01020a',
}
