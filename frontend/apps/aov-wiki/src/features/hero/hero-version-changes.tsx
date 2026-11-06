import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { navArtIcons } from "@aov/ui/components/nav-art-icons"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText, type WikiPatch } from "../../context/wiki-context"
import { changeSetKind, changeSkillLabel, parseChangeSummary } from "../../lib/wiki-change-format"
import { ChangeDisclosure, ChangeKind, ChangeList } from "../updates/change-list"
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

/** Stays in reach once the changes have scrolled away, so a reader can go back after reading a skill in full. */
function BackToChanges({
  target,
  label,
  onBack,
}: {
  target: RefObject<HTMLElement | null>
  label: string
  onBack: () => void
}) {
  const [away, setAway] = useState(false)
  useEffect(() => {
    const node = target.current
    if (!node) return
    // Follows the section's heading, not the whole section: a page too short to scroll it fully away still needs this.
    const observer = new IntersectionObserver(
      // Several changes can arrive together while the page is busy, and only the latest one counts.
      (entries) => {
        const entry = entries[entries.length - 1]
        setAway(!entry.isIntersecting && entry.boundingClientRect.top < window.innerHeight / 2)
      },
      { rootMargin: "-56px 0px 0px 0px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [target])
  if (!away) return null
  return (
    <button type="button" className="wiki-version-float" onClick={onBack}>
      <navArtIcons.releases size={22} />
      {label}
      <WikiIcon name="chevron" size={16} />
    </button>
  )
}

export function HeroVersionChanges({
  hero,
  version,
  onOpenSkill,
}: {
  hero: HeroDetail
  version: HeroVersion
  onOpenSkill: (skillKey: string) => void
}) {
  const scope = useWikiContext()
  const { locale, href } = scope
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const { selected, previous, notes, lastChange, differences, showDiff, setShowDiff } = version
  const section = useRef<HTMLElement>(null)
  const heading = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
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
  const overall = notes.map((row) => changeSetKind(row)).find(Boolean)
  const count = officialChanges.length || differences.skills.size + differences.stats.size
  const backToChanges = () => {
    setExpanded(true)
    section.current?.scrollIntoView({ block: "start" })
    section.current?.focus({ preventScroll: true })
  }

  return (
    <>
      <section
        ref={section}
        tabIndex={-1}
        className="wiki-version-changes"
        data-state="changed"
        aria-label={text("Thay đổi ở bản này", "Changes in this version")}
      >
        <div ref={heading} className="wiki-version-changes-head">
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
          {overall && <ChangeKind kind={overall} />}
        </div>

        {summaries.map(
          (summary, index) =>
            summary.text && (
              <p className="wiki-version-summary" lang={notes[index].actualLocale ?? undefined} key={index}>
                {summary.text}
              </p>
            ),
        )}
        {!officialChanges.length && (
          <p className="wiki-version-note">
            {text(
              "Chưa có ghi chú chính thức cho bản này. Đây là khác biệt giữa hai bản dữ liệu, có thể gồm cả chỉnh sửa câu chữ.",
              "No official notes for this version. These are differences between two data versions and may include wording edits.",
            )}
          </p>
        )}

        <div className="wiki-version-actions">
          <ChangeDisclosure count={count} open={expanded} onToggle={() => setExpanded(!expanded)}>
            {officialChanges.length > 0 ? (
              <ChangeList
                changes={officialChanges}
                hero={hero}
                skillAction={(key, skill) =>
                  skill && (
                    <button
                      type="button"
                      className="wiki-change-skill-link"
                      aria-label={`${text("Xem kỹ năng đầy đủ", "See the full ability")}: ${skillName(key)}`}
                      onClick={() => onOpenSkill(key)}
                    >
                      {text("Xem kỹ năng đầy đủ", "See full ability")}
                      <WikiIcon name="chevron" size={14} />
                    </button>
                  )
                }
              />
            ) : (
              <ul className="wiki-version-list">
                {[...differences.skills.entries()].map(([key, difference]) => (
                  <li key={key}>
                    <button type="button" onClick={() => onOpenSkill(key)}>
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
            )}
          </ChangeDisclosure>
          <div className="wiki-version-links">
            {source && (
              <a href={source} target="_blank" rel="noopener noreferrer">
                {text("Nguồn công bố", "Publication source")} <WikiIcon name="open" size={14} />
              </a>
            )}
            <Link to={href(`/updates/${selected.code}`)}>
              {text("Xem toàn bộ bản cập nhật", "See the whole update")}
            </Link>
          </div>
          {hasCompared && (
            <label className="wiki-version-toggle">
              <input type="checkbox" checked={showDiff} onChange={(event) => setShowDiff(event.target.checked)} />
              {text("Đánh dấu trong kỹ năng", "Mark inside abilities")}
            </label>
          )}
        </div>
      </section>
      <BackToChanges
        target={heading}
        label={text(`Về thay đổi bản ${selected.code}`, `Back to ${selected.code} changes`)}
        onBack={backToChanges}
      />
    </>
  )
}
