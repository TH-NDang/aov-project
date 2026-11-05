import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText, type WikiPatch } from "../../context/wiki-context"
import { changeFieldLabel, changeSkillLabel, formatChangeValue, parseChangeSummary } from "../../lib/wiki-change-format"
import { ChangeKind } from "../updates/change-list"
import { heroChangesQuery } from "../updates/updates-api"
import "../updates/updates.css"
import { heroDetailQuery, type HeroDetail } from "./hero-api"
import {
  heroDifferences,
  NO_DIFFERENCES,
  orderedPatches,
  previousPatch,
  type HeroDifferences,
} from "./hero-version-diff"

/** What the selected version changed for this hero, from published notes and from comparing two snapshots. */
export function useHeroVersion(hero: HeroDetail) {
  const scope = useWikiContext()
  const patches = useMemo(() => scope.options?.patches ?? [], [scope.options])
  const seasons = useMemo(() => scope.options?.seasons ?? [], [scope.options])
  const selected =
    patches.find((patch) => patch.id === scope.patchVariantId) ??
    patches.find((patch) => patch.code === hero.context?.patch?.code)
  const previous = previousPatch(patches, seasons, selected)

  const earlier = useQuery({
    ...heroDetailQuery(hero.id, {
      region: scope.region,
      locale: scope.locale,
      seasonId: previous?.seasonId,
      patchVariantId: previous?.id,
      includeUnscoped: false,
    }),
    enabled: !!previous,
  })
  const history = useQuery(heroChangesQuery(scope, hero.id))
  const rows = useMemo(() => (history.data ?? []).filter((row) => row.summary || row.changes?.length), [history.data])
  const notes = rows.filter((row) => row.patchVariantId === selected?.id)

  const line = orderedPatches(patches, seasons)
  const position = (id?: string) => line.findIndex((patch) => patch.id === id)
  const lastChange = rows
    .map((row) => line.find((patch) => patch.id === row.patchVariantId))
    .filter((patch): patch is WikiPatch => !!patch && position(patch.id) < position(selected?.id))
    .sort((a, b) => position(b.id) - position(a.id))[0]

  const differences: HeroDifferences = useMemo(
    () =>
      earlier.data && earlier.data.revisionId !== hero.revisionId
        ? heroDifferences(earlier.data, hero)
        : NO_DIFFERENCES,
    [earlier.data, hero],
  )
  const changedSkills = useMemo(() => {
    const keys = new Set(differences.skills.keys())
    for (const row of notes) for (const change of row.changes ?? []) if (change.skillKey) keys.add(change.skillKey)
    return keys
    // notes is derived from rows and the selected version on every render.
  }, [differences, rows, selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const [showDiff, setShowDiff] = useState(true)
  return {
    selected,
    previous,
    notes,
    rows,
    lastChange,
    differences,
    changedSkills,
    showDiff,
    setShowDiff,
    pending: history.isPending || (!!previous && earlier.isPending),
  }
}

export type HeroVersion = ReturnType<typeof useHeroVersion>

export function HeroVersionChanges({
  hero,
  version,
  onSelectSkill,
}: {
  hero: HeroDetail
  version: HeroVersion
  onSelectSkill: (skillKey: string) => void
}) {
  const scope = useWikiContext()
  const { locale, href } = scope
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const { selected, previous, notes, lastChange, differences, showDiff, setShowDiff } = version
  const open = (patch: WikiPatch) =>
    scope.setScope(
      patch.isCurrent
        ? { seasonId: "", patchVariantId: "", includeUnscoped: false }
        : { seasonId: patch.seasonId, patchVariantId: patch.id, includeUnscoped: false },
    )

  if (!selected || version.pending) return null

  const name = hero.content.profile?.name ?? hero.code
  const skills = new Map(hero.content.skills?.skills?.map((skill) => [skill.skillKey, skill]))
  const skillName = (key: string) => skills.get(key)?.name || changeSkillLabel(key, locale)
  const hasCompared = differences.skills.size > 0 || differences.stats.size > 0
  const officialChanges = notes.flatMap((row) => row.changes ?? [])

  if (!notes.length && !hasCompared) {
    if (!lastChange && !previous) return null
    return (
      <section
        className="wiki-version-changes"
        data-state="unchanged"
        aria-label={text("Thay đổi ở bản này", "Changes in this version")}
      >
        <div className="wiki-version-changes-head">
          <h2>{text(`Bản ${selected.code} không thay đổi ${name}`, `${selected.code} did not change ${name}`)}</h2>
          {lastChange && (
            <button type="button" className="wiki-version-changes-link" onClick={() => open(lastChange)}>
              {text(`Xem thay đổi gần nhất: ${lastChange.code}`, `See the latest change: ${lastChange.code}`)}
              <WikiIcon name="arrow" size={14} />
            </button>
          )}
        </div>
        <p>
          {lastChange
            ? text(
                `Nội dung bên dưới giống bản ${lastChange.code}.`,
                `The content below is the same as ${lastChange.code}.`,
              )
            : text("Tướng chưa có thay đổi nào được ghi nhận.", "No changes have been recorded for this hero.")}
        </p>
      </section>
    )
  }

  const summaries = notes.map((row) => parseChangeSummary(row.summary))
  const source =
    notes.map((row) => row.sourceUrl).find((url) => url && /^https:\/\//i.test(url)) ??
    summaries.map((summary) => summary.source).find(Boolean)
  return (
    <section
      className="wiki-version-changes"
      data-state="changed"
      aria-label={text("Thay đổi ở bản này", "Changes in this version")}
    >
      <div className="wiki-version-changes-head">
        <div>
          <h2>{text(`Thay đổi ở bản ${selected.code}`, `Changes in ${selected.code}`)}</h2>
          {previous && (
            <p>
              {text("So với ", "Compared with ")}
              <button type="button" onClick={() => open(previous)}>
                {previous.code}
              </button>
            </p>
          )}
        </div>
        {hasCompared && (
          <label className="wiki-version-toggle">
            <input type="checkbox" checked={showDiff} onChange={(event) => setShowDiff(event.target.checked)} />
            {text("Đánh dấu trong kỹ năng", "Mark inside abilities")}
          </label>
        )}
      </div>

      {summaries.map(
        (summary, index) =>
          summary.text && (
            <p className="wiki-version-summary" lang={notes[index].actualLocale ?? undefined} key={index}>
              {summary.text}
            </p>
          ),
      )}

      <ul className="wiki-version-list">
        {officialChanges.map((change) => {
          const label = change.skillKey ? skillName(change.skillKey) : null
          const body = (
            <>
              <span className="wiki-version-row-head">
                <strong>
                  {label && `${label} · `}
                  {change.fieldKey ? changeFieldLabel(change.fieldKey, locale) : text("Cơ chế", "Mechanic")}
                </strong>
                <ChangeKind kind={change.changeKind} />
              </span>
              {change.fieldKey ? (
                <span className="wiki-change-values">
                  <del>{formatChangeValue(change.oldValue, locale)}</del>
                  <span aria-hidden="true" className="wiki-change-arrow">
                    →
                  </span>
                  <ins>{formatChangeValue(change.newValue, locale)}</ins>
                </span>
              ) : (
                change.description && <span>{change.description}</span>
              )}
            </>
          )
          return (
            <li key={change.id}>
              {change.skillKey && skills.has(change.skillKey) ? (
                <button type="button" onClick={() => onSelectSkill(change.skillKey!)}>
                  {body}
                </button>
              ) : (
                <div>{body}</div>
              )}
            </li>
          )
        })}
        {!officialChanges.length &&
          [...differences.skills.entries()].map(([key, difference]) => (
            <li key={key}>
              <button type="button" onClick={() => onSelectSkill(key)}>
                <span className="wiki-version-row-head">
                  <strong>{skillName(key)}</strong>
                </span>
                <span>
                  {difference.isNew
                    ? text("Kỹ năng mới ở bản này", "New ability in this version")
                    : text("Nội dung kỹ năng có thay đổi", "The ability text changed")}
                </span>
              </button>
            </li>
          ))}
      </ul>

      <div className="wiki-version-links">
        {source && (
          <a href={source} target="_blank" rel="noopener noreferrer">
            {text("Nguồn công bố", "Publication source")} <WikiIcon name="open" size={14} />
          </a>
        )}
        <Link to={href(`/updates/${selected.code}`)}>{text("Xem toàn bộ bản cập nhật", "See the whole update")}</Link>
      </div>
    </section>
  )
}
