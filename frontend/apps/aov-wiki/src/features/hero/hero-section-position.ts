export interface SectionPosition {
  id: string
  top: number
}

/**
 * The section being read: the last one, going down the page, whose start has passed `line`. Sections side by side count
 * in the order given. `atEnd` covers a final section too short to ever reach the line.
 */
export function activeSection(positions: SectionPosition[], line: number, atEnd: boolean) {
  if (atEnd) return positions.at(-1)?.id
  const passed = positions.filter((section) => section.top <= line)
  return passed.at(-1)?.id ?? positions[0]?.id
}
