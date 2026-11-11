/** The stat as the game shows it, such as "150 | 20%". A percent nobody recorded stays out. */
export function statText(stat: { baseValue: number | null; percentValue?: number | null }) {
  const number = String(stat.baseValue ?? "")
  return stat.percentValue == null ? number : `${number} | ${stat.percentValue}%`
}

export const localizedStatText = (text: string, locale: string) =>
  text.replace(/\d+(?:\.\d+)?/g, (number) => Number(number).toLocaleString(locale))
