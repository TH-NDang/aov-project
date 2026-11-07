import { normalizedUnit, observedStat, type AttributeRow, type StatReading, type StatSample } from "./combat-attributes"

function comparableReading(row: AttributeRow, peer: StatSample, patchCode: string, level: number | null) {
  const capture = peer.capture
  const fromPatch = capture?.patchCode === patchCode
  if (row.key === "MAX_RESOURCE") {
    const resource = row.reading?.resource
    if (!resource || !fromPatch || observedStat(row.key, capture.values)?.resource !== resource) return
  }
  if (row.kind === "Giá trị riêng") {
    const stat = peer.baseStats[row.key]
    return stat && { ...stat, percent: stat.percent ?? undefined }
  }
  if (row.kind === "Ghi nhận từ ảnh" && fromPatch && capture.level === level)
    return observedStat(row.key, capture.values)
}

export function statDistribution(current: number | string, values: (number | string)[]) {
  const total = values.length
  const matches = values.filter((v) => v === current).length
  const numeric =
    typeof current === "number" ? values.filter((v): v is number => typeof v === "number").sort((a, b) => a - b) : []
  const middle = Math.floor(numeric.length / 2)
  const median = numeric.length ? (numeric[middle] + numeric[Math.floor((numeric.length - 1) / 2)]) / 2 : undefined
  let label = "Chưa đủ mẫu"
  if (total >= 5) {
    if (matches === total) label = "Đồng mức"
    else if (matches > total / 2) label = "Phổ biến"
    else if (typeof current === "string")
      label = matches ? (matches * 2 === total ? "Một nửa nhóm" : "Thiểu số") : "Chưa gặp trong nhóm"
    else {
      const rank = (numeric.filter((v) => v < current).length + matches / 2) / total
      label = rank <= 0.25 ? "Thấp" : rank >= 0.75 ? "Cao" : "Trung bình"
    }
  }
  return { label, total, matches, median, min: numeric[0], max: numeric.at(-1) }
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
