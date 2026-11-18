import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { navArtIcons } from "@aov/ui/components/nav-art-icons"
import { WikiIcon } from "../../../components/wiki-icon"
import { useWikiContext, wikiText, type WikiPatch, useWikiText } from "../../../context/wiki-context"
import { changeSetKind, changeSkillLabel, parseChangeSummary } from "../../../lib/wiki-change-format"
import { ChangeDisclosure, ChangeKind, ChangeList } from "../../../components/change-list"
import { heroChangesQuery } from "../../../lib/updates-api"
import type { HeroDetail } from "../../../lib/hero-api"
import { orderedPatches, previousPatch } from "../../../lib/hero-patch-line"
import { PatchName } from "../../../components/hero-patch-name"

/** The side mark of the band says what the version did to the hero, in the tones the home page uses. */
const TONES: Record<string, string> = { RELEASE: "new", ADDED: "new", REWORK: "rework", BUFF: "up", NERF: "down" }

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
  const notes = useMemo(() => rows.filter((row) => row.patchVariantId === selected?.id), [rows, selected?.id])

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
  }, [notes])

  return { selected, previous, notes, rows, lastChange, changedSkills, pending: history.isPending }
}

export type HeroVersion = ReturnType<typeof useHeroVersion>

/** Reads the page at another version; the version in force is the page without a version in its address. */
export function usePatchOpener() {
  const { setScope } = useWikiContext()
  return (patch: WikiPatch) =>
    setScope(
      patch.isCurrent
        ? { seasonId: "", patchVariantId: "", includeUnscoped: false }
        : { seasonId: patch.seasonId, patchVariantId: patch.id, includeUnscoped: false },
    )
}

/** Shown after jumping from a change to its skill, so a reader can go back; it leaves once they have. */
function BackToChanges({
  target,
  label,
  onBack,
  onReturned,
}: {
  target: RefObject<HTMLElement | null>
  label: ReactNode
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
      <span>{label}</span>
      <WikiIcon name="chevron" size={16} />
    </button>
  )
}

/**
 * One quiet line under the version picker when the chosen version left the hero alone. The picker already marks the
 * versions that did change the hero, so this only says it in words and offers the nearest one.
 */
export function HeroVersionUnchanged({ hero, version }: { hero: HeroDetail; version: HeroVersion }) {
  const { locale } = useWikiContext()
  const open = usePatchOpener()
  const { selected, previous, notes, lastChange } = version
  if (!selected || version.pending || notes.length) return null
  if (!lastChange && !previous) return null
  const name = hero.content.profile?.name ?? hero.code
  return (
    <p className="wiki-hero-scope-note" role="note">
      <span>{wikiText(locale, `Bản này không thay đổi ${name}.`, `This version did not change ${name}.`)}</span>
      {lastChange && (
        <button type="button" onClick={() => open(lastChange)}>
          <span>
            {wikiText(locale, "Xem thay đổi gần nhất: ", "See the latest change: ")}
            <PatchName patch={lastChange} />
          </span>
          <WikiIcon name="arrow" size={14} />
        </button>
      )}
    </p>
  )
}

/** What the chosen version changed for the hero: one surface, marked on its side with the tone of the change. */
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
  const { locale, href } = useWikiContext()
  const text = useWikiText()
  const open = usePatchOpener()
  const { selected, previous, notes } = version
  const section = useRef<HTMLElement & { open?: boolean }>(null)
  const heading = useRef<HTMLElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [jumped, setJumped] = useState(false)
  const settle = useCallback(() => setJumped(false), [])
  const jumpToSkill = (skillKey: string) => {
    setJumped(true)
    onOpenSkill(skillKey)
  }

  if (!selected || version.pending || !notes.length) return null

  const skills = new Map(hero.content.skills?.skills?.map((skill) => [skill.skillKey, skill]))
  const skillName = (key: string) => skills.get(key)?.name || changeSkillLabel(key, locale)
  const officialChanges = notes.flatMap((row) => row.changes ?? [])
  const summaries = notes.map((row) => parseChangeSummary(row.summary))
  const source =
    notes.map((row) => row.sourceUrl).find((url) => url && /^https:\/\//i.test(url)) ??
    summaries.map((summary) => summary.source).find(Boolean)
  const overall = notes.map((row) => changeSetKind(row)).find(Boolean)
  const tone = overall ? TONES[overall] : undefined
  const count = officialChanges.length
  const backToChanges = () => {
    setExpanded(true)
    if (section.current && collapsible) section.current.open = true
    section.current?.scrollIntoView({ block: "start" })
    section.current?.focus({ preventScroll: true })
  }
  const compared = previous && (
    <p className="wiki-version-compared">
      {text("So với ", "Compared with ")}
      <button type="button" onClick={() => open(previous)}>
        <PatchName patch={previous} />
      </button>
    </p>
  )

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
      {count > 0 && (
        <ChangeDisclosure count={count} open={expanded} onToggle={() => setExpanded(!expanded)}>
          <ChangeList
            changes={officialChanges}
            hero={hero}
            overallKind={overall}
            layout="ruled"
            skillAction={(key, skill) =>
              skill && (
                <button
                  type="button"
                  className="wiki-change-skill-link"
                  aria-label={`${text("Xem kỹ năng đầy đủ", "See the full ability")}: ${skillName(key)}`}
                  onClick={() => jumpToSkill(key)}
                >
                  {/* The single column is narrow, so the link keeps to two words there. */}
                  {collapsible ? text("Xem kỹ năng", "See ability") : text("Xem kỹ năng đầy đủ", "See full ability")}
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
        <Link to={href(`/updates/${selected.code}`)}>
          {text("Xem ghi chú đầy đủ", "See the full notes")} <WikiIcon name="arrow" size={14} />
        </Link>
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
          data-tone={tone}
        >
          <summary ref={heading as RefObject<HTMLElement>} className="wiki-version-changes-line">
            <strong>{text("Thay đổi ở bản này", "Changes in this version")}</strong>
            {overall && <ChangeKind kind={overall} />}
            <WikiIcon name="chevron" size={16} />
          </summary>
          <div className="wiki-version-changes-body">
            {compared}
            {body}
          </div>
        </details>
      ) : (
        <section
          ref={section}
          tabIndex={-1}
          id="wiki-version-changes"
          className="wiki-version-changes"
          data-tone={tone}
          aria-label={text("Thay đổi ở bản này", "Changes in this version")}
        >
          <div ref={heading as RefObject<HTMLDivElement>} className="wiki-version-changes-head">
            <h2>
              {text("Thay đổi ở bản ", "Changes in ")}
              <PatchName patch={selected} />
            </h2>
            {compared}
            {overall && <ChangeKind kind={overall} className="wiki-version-changes-kind" />}
          </div>
          {body}
        </section>
      )}
      {jumped && (
        <BackToChanges
          target={heading}
          label={
            <>
              {text("Về thay đổi bản ", "Back to the changes of ")}
              <PatchName patch={selected} />
            </>
          }
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
