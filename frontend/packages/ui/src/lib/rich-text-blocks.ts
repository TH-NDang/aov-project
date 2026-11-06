export const paragraphStyles = {
  note: { label: "Chú thích", classes: "block text-xs leading-5 text-muted-foreground" },
  info: { label: "Thông tin", classes: "my-2 block border-l-2 border-sky-500/50 pl-3 text-sm" },
  example: { label: "Ví dụ", classes: "my-2 block border-l-2 border-primary/30 pl-3 text-sm" },
} as const
/** The color the imported skill descriptions use most for each meaning. */
export const gameTextColors = [
  { label: "Sát thương vật lý", color: "#b53653" },
  { label: "Sát thương phép", color: "#aa6ad8" },
  { label: "Công vật lý", color: "#c6633e" },
  { label: "Công phép", color: "#9a71e2" },
  { label: "Khống chế", color: "#c36a84" },
  { label: "Lá chắn, tốc chạy", color: "#5aadc9" },
  { label: "Hồi máu", color: "#84c94a" },
  { label: "Dấu ấn", color: "#d0b88e" },
] as const

/** Colors a text already uses, most used first. */
export function colorsUsedIn(value: string): string[] {
  const counts = new Map<string, number>()
  for (const match of value.matchAll(/<color=(#[\da-f]{6})>/gi)) {
    const color = match[1]!.toLowerCase()
    counts.set(color, (counts.get(color) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([color]) => color)
}

export type ParagraphStyle = keyof typeof paragraphStyles
export const isParagraphStyle = (value: string): value is ParagraphStyle => Object.hasOwn(paragraphStyles, value)

export const tableLimits = { rows: 16, columns: 6, cell: 200 } as const
export const exampleTablePattern = /<exampletable>([^<>]*)<\/exampletable>/gi
export function readExampleTable(value: string): string[][] | null {
  try {
    const rows: unknown = JSON.parse(value)
    if (!Array.isArray(rows) || rows.length < 2 || rows.length > tableLimits.rows) return null
    const width = Array.isArray(rows[0]) ? rows[0].length : 0
    return width > 0 &&
      width <= tableLimits.columns &&
      rows.every(
        (row) =>
          Array.isArray(row) &&
          row.length === width &&
          row.every((cell) => typeof cell === "string" && cell.length <= tableLimits.cell),
      )
      ? rows
      : null
  } catch {
    return null
  }
}

export function writeExampleTable(rows: string[][]) {
  const data = JSON.stringify(rows).replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
  return `<exampletable>${data}</exampletable>`
}
