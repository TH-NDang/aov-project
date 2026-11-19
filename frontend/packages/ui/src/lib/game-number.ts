const formatters = new Map<number, Intl.NumberFormat>()

/**
 * Writes a figure of the game the way the game writes it (`frontend/docs/QUY-UOC-VIET.md` section 3): no thousands
 * separator and a dot for decimals, whatever the reader's locale. Use it for health, damage, seconds, metres,
 * percentages and gold in hero, item, arcana and trait text and in editorial notes. Interface numbers (row counts,
 * views, statistics, money) follow the reader's locale instead.
 */
export function formatGameNumber(value: number, maximumFractionDigits = 6): string {
  let formatter = formatters.get(maximumFractionDigits)
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", { useGrouping: false, maximumFractionDigits })
    formatters.set(maximumFractionDigits, formatter)
  }
  const text = formatter.format(value)
  return text === "-0" ? "0" : text
}
