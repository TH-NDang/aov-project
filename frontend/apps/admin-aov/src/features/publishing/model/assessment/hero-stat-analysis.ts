import { normalizedUnit, observedStat, type AttributeRow, type StatReading, type StatSample } from "./combat-attributes"

function comparableReading(row: AttributeRow, peer: StatSample, patchCode: string, level: number | null) {
  const capture = peer.capture
  const fromPatch = capture?.patchCode === patchCode
  if (row.key === "MAX_RESOURCE") {
    const resource = row.reading?.resource
    if (!resource || !fromPatch || observedStat(row.key, capture.values)?.resource !== resource) return
  }
  if (row.kind === "OWN") {
    const stat = peer.baseStats[row.key]
    return stat && { ...stat, percent: stat.percent ?? undefined }
  }
  if (row.kind === "CAPTURED" && fromPatch && capture.level === level) return observedStat(row.key, capture.values)
}

/** Where a value sits among the heroes it is compared with. */
export type StatStanding =
  "FEW_SAMPLES" | "SAME_FOR_ALL" | "COMMON" | "HALF" | "MINORITY" | "UNSEEN" | "LOW" | "HIGH" | "MIDDLE"

export const STAT_STANDING_LABELS: Record<StatStanding, string> = {
  FEW_SAMPLES: "Chưa đủ mẫu",
  SAME_FOR_ALL: "Đồng mức",
  COMMON: "Phổ biến",
  HALF: "Một nửa nhóm",
  MINORITY: "Thiểu số",
  UNSEEN: "Chưa gặp trong nhóm",
  LOW: "Thấp",
  HIGH: "Cao",
  MIDDLE: "Trung bình",
}

export function statDistribution(current: number | string, values: (number | string)[]) {
  const total = values.length
  const matches = values.filter((v) => v === current).length
  const numeric =
    typeof current === "number" ? values.filter((v): v is number => typeof v === "number").sort((a, b) => a - b) : []
  const middle = Math.floor(numeric.length / 2)
  const median = numeric.length ? (numeric[middle] + numeric[Math.floor((numeric.length - 1) / 2)]) / 2 : undefined
  let standing: StatStanding = "FEW_SAMPLES"
  if (total >= 5) {
    if (matches === total) standing = "SAME_FOR_ALL"
    else if (matches > total / 2) standing = "COMMON"
    else if (typeof current === "string") standing = matches ? (matches * 2 === total ? "HALF" : "MINORITY") : "UNSEEN"
    else {
      const rank = (numeric.filter((v) => v < current).length + matches / 2) / total
      standing = rank <= 0.25 ? "LOW" : rank >= 0.75 ? "HIGH" : "MIDDLE"
    }
  }
  const label = STAT_STANDING_LABELS[standing]
  return { standing, label, total, matches, median, min: numeric[0], max: numeric.at(-1) }
}

export function analyzeStat(row: AttributeRow, peers: StatSample[], patchCode: string, level: number | null) {
  const target = row.reading
  if (!target) return
  const primary: (number | string)[] = []
  const secondary: number[] = []
  for (const peer of peers) {
    const reading: StatReading | undefined = comparableReading(row, peer, patchCode, level)
    if (!reading) continue
    const unit = normalizedUnit(row.key, reading.unit)
    if (
      unit &&
      unit !== "UNKNOWN" &&
      unit === normalizedUnit(row.key, target.unit) &&
      reading.value !== undefined &&
      typeof reading.value === typeof target.value
    )
      primary.push(reading.value)
    if (typeof reading.percent === "number") secondary.push(reading.percent)
  }
  return {
    primary: target.value === undefined ? undefined : statDistribution(target.value, primary),
    secondary: target.percent === undefined ? undefined : statDistribution(target.percent, secondary),
  }
}
