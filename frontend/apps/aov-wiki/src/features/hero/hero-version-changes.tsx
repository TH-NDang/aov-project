import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { navArtIcons } from "@aov/ui/components/nav-art-icons"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText, type WikiPatch } from "../../context/wiki-context"
import { changeSetKind, changeSkillLabel, parseChangeSummary } from "../../lib/wiki-change-format"
import { ChangeDisclosure, ChangeKind, ChangeList } from "../updates/change-list"
import { heroChangesQuery } from "../updates/updates-api"
import "../updates/updates.css"
import type { HeroDetail } from "./hero-api"
import { orderedPatches, previousPatch } from "./hero-patch-line"

/**
 * What the selected version changed for this hero, from published patch notes only. Two snapshots of the hero can also
 * differ in wording or spelling; that is editorial work, which Admin compares and the public page never shows.
 */
export function useHeroVersion(hero: HeroDetail) {
  const scope = useWikiContext()
  const patches = useMemo(() => scope.options?.patches ?? [], [scope.options])
  const seasons = useMemo(() => scope.options?.seasons ?? [], [scope.options])
  const selected =
    patches.find((patch) => patch.id === scope.patchVariantId) ??
    patches.find((patch) => patch.code === hero.context?.patch?.code)
  const previous = previousPatch(patches, seasons, selected)

  const history = useQuery(heroChangesQuery(scope, hero.id))
  const rows = useMemo(() => (history.data ?? []).filter((row) => row.summary || row.changes?.length), [history.data])
  const notes = rows.filter((row) => row.patchVariantId === selected?.id)

  const line = orderedPatches(patches, seasons)
  const position = (id?: string) => line.findIndex((patch) => patch.id === id)
  const lastChange = rows
    .map((row) => line.find((patch) => patch.id === row.patchVariantId))
    .filter((patch): patch is WikiPatch => !!patch && position(patch.id) < position(selected?.id))
    .sort((a, b) => position(b.id) - position(a.id))[0]

  const changedSkills = useMemo(() => {
    const keys = new Set<string>()
    for (const row of notes) for (const change of row.changes ?? []) if (change.skillKey) keys.add(change.skillKey)
    return keys
    // notes is derived from rows and the selected version on every render.
  }, [rows, selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return { selected, previous, notes, rows, lastChange, changedSkills, pending: history.isPending }
}

export type HeroVersion = ReturnType<typeof useHeroVersion>

/** Shown after jumping from a change to its skill, so a reader can go back; it leaves once they have. */
function BackToChanges({
  target,
  label,
  onBack,
  onReturned,
}: {
  target: RefObject<HTMLElement | null>
  label: string
  onBack: () => void
  onReturned: () => void
}) {
  const [away, setAway] = useState(false)
  const wasAway = useRef(false)
  useEffect(() => {
    const node = target.current
    if (!node) return
    // Follows the section's heading, not the whole section: a page too short to scroll it fully away still needs this.
    const observer = new IntersectionObserver(
      // Several changes can arrive together while the page is busy, and only the latest one counts.
      (entries) => {
        const entry = entries[entries.length - 1]
        const isAway = !entry.isIntersecting && entry.boundingClientRect.top < window.innerHeight / 2
        if (wasAway.current && !isAway) onReturned()
        wasAway.current = isAway
        setAway(isAway)
      },
      { rootMargin: "-56px 0px 0px 0px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [target, onReturned])
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
  collapsible = false,
}: {
  hero: HeroDetail
  version: HeroVersion
  onOpenSkill: (skillKey: string) => void
  /** One line that opens downward, for a single column where the full list would stand in the way of the abilities. */
  collapsible?: boolean
}) {
  const scope = useWikiContext()
  const { locale, href } = scope
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const { selected, previous, notes, lastChange } = version
  const section = useRef<HTMLElement & { open?: boolean }>(null)
  const heading = useRef<HTMLElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [jumped, setJumped] = useState(false)
  const settle = useCallback(() => setJumped(false), [])
  const jumpToSkill = (skillKey: string) => {
    setJumped(true)
    onOpenSkill(skillKey)
  }
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
  const officialChanges = notes.flatMap((row) => row.changes ?? [])

  if (!notes.length) {
    if (!lastChange && !previous) return null
    return (
      <section
        id="wiki-version-changes"
        tabIndex={-1}
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
          {text(
            `Ghi chú cập nhật của bản ${selected.code} không nhắc đến ${name}.`,
            `The ${selected.code} patch notes do not mention ${name}.`,
          )}
        </p>
      </section>
    )
  }

  const summaries = notes.map((row) => parseChangeSummary(row.summary))
  const source =
    notes.map((row) => row.sourceUrl).find((url) => url && /^https:\/\//i.test(url)) ??
    summaries.map((summary) => summary.source).find(Boolean)
  const overall = notes.map((row) => changeSetKind(row)).find(Boolean)
  const count = officialChanges.length
  const backToChanges = () => {
    setExpanded(true)
    if (section.current && collapsible) section.current.open = true
    section.current?.scrollIntoView({ block: "start" })
    section.current?.focus({ preventScroll: true })
  }

  const body = (
    <>
      {summaries.map(
        (summary, index) =>
          summary.text && (
            <p className="wiki-version-summary" lang={notes[index].actualLocale ?? undefined} key={index}>
              {summary.text}
            </p>
          ),
      )}
      <div className="wiki-version-actions">
        {count > 0 && (
          <ChangeDisclosure count={count} open={expanded} onToggle={() => setExpanded(!expanded)}>
            <ChangeList
              changes={officialChanges}
              hero={hero}
              skillAction={(key, skill) =>
                skill && (
                  <button
                    type="button"
                    className="wiki-change-skill-link"
                    aria-label={`${text("Xem kỹ năng đầy đủ", "See the full ability")}: ${skillName(key)}`}
                    onClick={() => jumpToSkill(key)}
                  >
                    {text("Xem kỹ năng đầy đủ", "See full ability")}
                    <WikiIcon name="chevron" size={14} />
                  </button>
                )
              }
            />
          </ChangeDisclosure>
        )}
        <div className="wiki-version-links">
          {source && (
            <a href={source} target="_blank" rel="noopener noreferrer">
              {text("Nguồn công bố", "Publication source")} <WikiIcon name="open" size={14} />
            </a>
          )}
          <Link to={href(`/updates/${selected.code}`)}>{text("Xem toàn bộ bản cập nhật", "See the whole update")}</Link>
        </div>
      </div>
    </>
  )

  return (
    <>
      {collapsible ? (
        <details
          ref={section as RefObject<HTMLDetailsElement>}
          tabIndex={-1}
          id="wiki-version-changes"
          className="wiki-version-changes"
          data-state="changed"
        >
          <summary ref={heading as RefObject<HTMLElement>} className="wiki-version-changes-line">
            <strong>{text("Thay đổi ở bản này", "Changes in this version")}</strong>
            {overall && <ChangeKind kind={overall} />}
            <WikiIcon name="chevron" size={16} />
          </summary>
          {previous && (
            <p className="wiki-version-compared">
              {text("So với ", "Compared with ")}
              <button type="button" onClick={() => open(previous)}>
                {previous.code}
              </button>
            </p>
          )}
          {body}
        </details>
      ) : (
        <section
          ref={section}
          tabIndex={-1}
          id="wiki-version-changes"
          className="wiki-version-changes"
          data-state="changed"
          aria-label={text("Thay đổi ở bản này", "Changes in this version")}
        >
          <div ref={heading as RefObject<HTMLDivElement>} className="wiki-version-changes-head">
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
          {body}
        </section>
      )}
      {jumped && (
        <BackToChanges
          target={heading}
          label={text(`Về thay đổi bản ${selected.code}`, `Back to ${selected.code} changes`)}
          onBack={() => {
            setJumped(false)
            backToChanges()
          }}
          onReturned={settle}
        />
      )}
    </>
  )
}
