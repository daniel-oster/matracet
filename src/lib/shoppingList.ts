export function formatAmount(mangd: number, enhet: string): string {
  const n = Number.isInteger(mangd) ? mangd : Math.round(mangd * 10) / 10
  return enhet ? `${n} ${enhet}` : `${n}`
}

/** One shopping-list line: the item, optionally why it's there (a meal name, a matched
 * bargain's store/brand), and optionally its price — same shape on screen and in the
 * copy-to-clipboard text. */
export function formatShopLine(main: string, why?: string | null, price?: string | null): string {
  let line = main
  if (why) line += ` (${why})`
  if (price) line += ` — ${price}`
  return line
}

export interface ShoppingListTextInput {
  weekLabel: string
  /** Already-formatted lines, one per item, in the same (aisle-walk) order shown on screen. */
  lines: string[]
  removedLabels: string[]
}

/** Plain-text snapshot of the current list, meant to be copied and pasted back as a prompt. */
export function buildShoppingListText({ weekLabel, lines, removedLabels }: ShoppingListTextInput): string {
  const out: string[] = [`Inköpslista – ${weekLabel}`, '']

  if (lines.length > 0) {
    for (const l of lines) out.push(`- ${l}`)
    out.push('')
  } else {
    out.push('(Listan är tom.)')
    out.push('')
  }

  if (removedLabels.length > 0) {
    out.push('—')
    out.push('Bortmarkerat (redan hemma / inte längre aktuellt)')
    for (const r of removedLabels) out.push(`- ${r}`)
  }

  return out.join('\n').trim()
}
