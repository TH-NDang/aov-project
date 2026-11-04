export const paragraphStyles = {
  note: { label: "Chú thích", classes: "block text-xs leading-5 text-muted-foreground" },
  info: { label: "Thông tin", classes: "my-2 block border-l-2 border-sky-500/50 pl-3 text-sm" },
  example: { label: "Ví dụ", classes: "my-2 block border-l-2 border-primary/30 pl-3 text-sm" },
} as const
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
