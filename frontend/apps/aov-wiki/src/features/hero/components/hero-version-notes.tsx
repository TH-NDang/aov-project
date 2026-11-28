import { useCallback, useRef, useState } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../../../components/wiki-icon"
import { useWikiContext, useWikiText } from "../../../context/wiki-context"
import { changeSetKind, changeSkillLabel, parseChangeSummary } from "../../../lib/wiki-change-format"
import { ChangeDisclosure, ChangeList } from "../../../components/change-list"
import type { HeroDetail } from "../../../lib/hero-api"
import { PatchName } from "../../../components/hero-patch-name"
import { BackToChanges, CHANGE_TONES, usePatchOpener, type HeroVersion } from "./hero-version-changes"
import { ChangeTag } from "../../../components/change-tag"
import { patchReleasesQuery } from "../../../lib/updates-api"
import { patchSourceLinks, preferredPatchSource } from "../../../lib/patch-sources"

/**
 * What the version being read changed for the hero, from its published notes: one band marked on its side with the tone
 * of the change, the summary, the changes by ability with a way to each ability, where it was published and the full
 * notes. Other versions are reached from the version picker above. A phone folds the band into one line that opens on
 * a tap, so the abilities stay near.
 */
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
  const text = useWikiText()
  const openPatch = usePatchOpener()
  const releases = useQuery(patchReleasesQuery(scope))
  const compact = usePageLayout() === "compact"
  const panel = useRef<HTMLElement>(null)
  const heading = useRef<HTMLDivElement>(null)
  const [unfolded, setUnfolded] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [jumped, setJumped] = useState(false)
  const settle = useCallback(() => setJumped(false), [])

  const { selected, previous, notes } = version
  if (!selected || version.pending || !notes.length) return null

  const skills = new Map(hero.content.skills?.skills?.map((skill) => [skill.skillKey, skill]))
  const skillName = (key: string) => skills.get(key)?.name || changeSkillLabel(key, locale)
  const changes = notes.flatMap((row) => row.changes ?? [])
  const summaries = notes.map((row) => parseChangeSummary(row.summary))
  // The patch's own links come first; a link written with the hero's change only stands in for a patch without any.
  const recorded =
    notes.map((row) => row.sourceUrl).find((url) => url && /^https:\/\//i.test(url)) ??
    summaries.map((summary) => summary.source).find(Boolean)
  const shared = releases.data?.find((release) => release.variantId === selected.id)?.sources
  const source = preferredPatchSource(patchSourceLinks(shared, recorded), locale)?.url
  const overall = notes.map((row) => changeSetKind(row)).find(Boolean)
  const open = !compact || unfolded
  const title = (
    <>
      {text("Thay đổi ở bản ", "Changes in ")}
      <PatchName patch={selected} />
    </>
  )

  return (
    <section
      ref={panel}
      id="wiki-version-changes"
      className="wiki-version-changes"
      data-tone={overall ? CHANGE_TONES[overall] : undefined}
      aria-label={text("Thay đổi ở bản này", "Changes in this version")}
      tabIndex={-1}
    >
      <div ref={heading} className="wiki-version-changes-head">
        {compact ? (
          <button
            type="button"
            className="wiki-version-changes-toggle"
            aria-expanded={unfolded}
            onClick={() => setUnfolded(!unfolded)}
          >
            <h2>{title}</h2>
            <ChangeTag kind={overall} />
            <WikiIcon name="chevron" size={16} />
          </button>
        ) : (
          <>
            <h2>{title}</h2>
            <span className="wiki-version-changes-kind">
              <ChangeTag kind={overall} />
            </span>
          </>
        )}
      </div>
      {open && (
        <>
          {previous && (
            <p className="wiki-version-compared">
              {text("So với ", "Compared with ")}
              <button type="button" onClick={() => openPatch(previous)}>
                <PatchName patch={previous} />
              </button>
            </p>
          )}
          {summaries.map(
            (summary, index) =>
              summary.text && (
                <p className="wiki-version-summary" lang={notes[index]?.actualLocale ?? undefined} key={index}>
                  {summary.text}
                </p>
              ),
          )}
          {changes.length > 0 && (
            <ChangeDisclosure count={changes.length} open={expanded} onToggle={() => setExpanded(!expanded)}>
              <ChangeList
                changes={changes}
                hero={hero}
                overallKind={overall}
                layout="ruled"
                kindMark={(kind) => <ChangeTag kind={kind} />}
                skillAction={(key, skill) =>
                  skill && (
                    <button
                      type="button"
                      className="wiki-change-skill-link"
                      aria-label={`${text("Xem kỹ năng đầy đủ", "See the full ability")}: ${skillName(key)}`}
                      onClick={() => {
                        setJumped(true)
                        onOpenSkill(key)
                      }}
                    >
                      {/* The single column is narrow, so the link keeps to two words there. */}
                      {compact ? text("Xem kỹ năng", "See ability") : text("Xem kỹ năng đầy đủ", "See full ability")}
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
            setUnfolded(true)
            setExpanded(true)
            panel.current?.scrollIntoView({ block: "start" })
            panel.current?.focus({ preventScroll: true })
          }}
          onReturned={settle}
        />
      )}
    </section>
  )
}

/** One quiet line under the version picker when the version being read left the hero alone. */
export function HeroVersionUnchanged({ hero, version }: { hero: HeroDetail; version: HeroVersion }) {
  const text = useWikiText()
  const { selected, notes } = version
  if (!selected || version.pending || notes.length || !version.rows.length) return null
  const name = hero.content.profile?.name ?? hero.code
  return (
    <p className="wiki-hero-scope-note" role="note">
      {text(`Bản này không thay đổi ${name}.`, `This version did not change ${name}.`)}
    </p>
  )
}
