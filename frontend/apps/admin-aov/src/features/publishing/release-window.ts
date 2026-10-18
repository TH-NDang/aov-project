import type { PublicationOverview, Release } from "./publication-overview"

const activationTime = (release: Release) => release.confirmedAt ?? release.effectiveAt ?? ""

export function releaseEnd(release: Release, data: PublicationOverview) {
  if (release.status !== "SCHEDULED") return null
  const next = data.releases
    .filter(
      (r) =>
        r.regionId === release.regionId &&
        r.status === "SCHEDULED" &&
        Date.parse(activationTime(r)) > Date.parse(activationTime(release)) &&
        data.variants.some((v) => v.id === r.variantId && v.status === "PUBLISHED"),
    )
    .sort((a, b) => Date.parse(activationTime(a)) - Date.parse(activationTime(b)))[0]
  const nextTime = next ? activationTime(next) : null
  const variant = data.variants.find((v) => v.id === release.variantId)
  const assignmentEnd = data.assignments.find(
    (a) =>
      a.regionId === release.regionId &&
      a.rulesetId === variant?.rulesetId &&
      Date.parse(a.validFrom) <= Date.parse(activationTime(release)) &&
      (!a.validTo || Date.parse(a.validTo) > Date.parse(activationTime(release))),
  )?.validTo
  if (nextTime && (!assignmentEnd || Date.parse(nextTime) <= Date.parse(assignmentEnd)))
    return next.effectiveOn ?? nextTime
  return assignmentEnd ?? null
}
