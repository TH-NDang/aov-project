import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useLocation, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { EntityRichText } from "@aov/ui/components/entity-rich-text"
import { gameplayIcons } from "@aov/ui/components/gameplay-icons"
import { OrnateDivider, OrnatePanel } from "../../components/ornate-panel"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { createEntityIndex } from "@aov/ui/lib/entity-rich-text"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { FeedbackDialog } from "../../layout/feedback-dialog"
import { HeroHistory } from "./hero-history"
import { HeroVersionChanges, useHeroVersion } from "./hero-version-changes"
import { localizedStatText, statText } from "./hero-stat-text"
import { HeroRatings } from "./hero-ratings"
import { useHeroVideos, useVideoParam, VideoGallery } from "../videos/subject-videos"
import { SkillIcon } from "./hero-skill-icon"
import { wikiReferencesQuery } from "../../lib/wiki-references"
import type { HeroDetail, PublicSkill } from "./hero-api"
import "./hero-handbook.css"
import { HeroSkins } from "./hero-skins"
import { HeroBuilds } from "./hero-builds"
import { HeroSectionNav } from "./hero-section-nav"
import { WikiIcon } from "../../components/wiki-icon"
import { SkillVideos } from "../videos/skill-videos"
import { SkillFormSwitch, SkillStateToggle, SkillVariantDots } from "@aov/ui/components/skill-kit"
import { groupSkillKit, skillCooldownRange, skillFormName } from "@aov/ui/lib/skill-kit"

function skillLabel(skill: PublicSkill, locale: string) {
  if (skill.kind === "PASSIVE") return wikiText(locale, "Nội tại", "Passive")
  const source = skill.effects?.find((effect) => effect.effectType === "SOURCE_SNAPSHOT")?.metadata?.sourceSlot
  const slot = typeof source === "number" ? source : /^skill_(\d+)$/.exec(String(source))?.[1]
  const number = slot ?? /^(?:skill|capture-skill)-(\d+)(?:-\d+)?$/.exec(skill.skillKey)?.[1]
  return Number(number) > 0 ? `${wikiText(locale, "Chiêu", "Skill")} ${number}` : wikiText(locale, "Kỹ năng", "Ability")
}

const baseStats = [
  ["HP", "Máu", "Health", gameplayIcons.heart],
  ["ATTACK_DAMAGE", "Công vật lý", "Physical attack", gameplayIcons.sword],
  ["ABILITY_POWER", "Công phép", "Ability power", gameplayIcons.orb],
  ["ARMOR", "Giáp", "Armor", gameplayIcons.shield],
  ["MAGIC_DEFENSE", "Giáp phép", "Magic defense", gameplayIcons.runeShield],
  ["MOVEMENT_SPEED", "Tốc chạy", "Movement speed", gameplayIcons.boot],
] as const

function scrollToAbilities() {
  const title = document.getElementById("wiki-kit-title")
  // Instant on purpose: an animated scroll stops partway when the content changes at the same moment.
  title?.scrollIntoView({ block: "start" })
  title?.focus({ preventScroll: true })
}

/** Stays short on a compact layout, above the changes; wider screens have room beside the abilities and show it whole. */
function OverviewSummary({ long, children }: { long: boolean; children: ReactNode }) {
  const { locale } = useWikiContext()
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="wiki-skill-prose wiki-hero-summary" data-open={open || !long || undefined}>
        {children}
      </div>
      {long && (
        <button type="button" className="wiki-hero-summary-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? wikiText(locale, "Thu gọn", "Show less") : wikiText(locale, "Xem thêm", "Show more")}
        </button>
      )}
    </>
  )
}

/** What both layouts of the hero page read from: the chosen ability, the version being compared and the videos. */
function useHandbook(hero: HeroDetail) {
  const scope = useWikiContext()
  const { locale } = scope
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const [params, setParams] = useSearchParams()
  const skills = [...(hero.content.skills?.skills ?? [])].sort((a, b) => a.displayOrder - b.displayOrder)
  const active = skills.find((skill) => skill.skillKey === params.get("skill")) ?? skills[0]
  const source = active?.effects?.find((effect) => effect.effectType === "SOURCE_SNAPSHOT")?.metadata
  const version = useHeroVersion(hero)
  const videos = useHeroVideos(hero.id, version.selected?.id)
  const videoParam = useVideoParam()
  const selectSkill = (skillKey: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set("skill", skillKey)
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  const activeKey = active?.skillKey
  // A shared link can name a video of another skill, which then has to be the skill on screen for the video to open.
  useEffect(() => {
    for (const [skillKey, list] of videos.bySkill)
      if (skillKey !== activeKey && list.some((video) => video.id === videoParam.id)) selectSkill(skillKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoParam.id, videos.bySkill])
  const references = useQuery(wikiReferencesQuery(scope))
  const settings = references.data
  const index = useMemo(
    () =>
      createEntityIndex(
        (settings?.entities ?? []).map((entity) =>
          entity.kind === "skill" && entity.heroId === hero.id && entity.revisionId === hero.revisionId
            ? { ...entity, matchBracketedName: true }
            : entity,
        ),
        locale,
        settings?.fallbackLocale ?? "vi-VN",
      ),
    [hero.id, hero.revisionId, settings, locale],
  )
  function rich(value: string) {
    if (/^[\d\s+−.,/%-]+$/.test(value)) return value
    return (
      <EntityRichText
        text={value}
        index={index}
        locale={locale}
        fallbackLocale={settings?.fallbackLocale}
        autoRecognize={settings?.autoRecognize ?? false}
        context="wiki"
      />
    )
  }
  const table = source?.levelTable
  const columns = Array.isArray(table?.column_labels) ? table.column_labels : []
  const tableLabel = columns.some((label) => /^(?:Lv\.?|Cấp)\s*\d+$/i.test(label))
    ? text("Thông số theo cấp chiêu", "Stats by ability rank")
    : text("Thông số kỹ năng", "Ability stats")
  const rows = Array.isArray(table?.rows)
    ? table.rows.filter((row) => row?.label && Array.isArray(row.display_values) && row.display_values.length)
    : []
  const profile = hero.content.profile
  const facts = baseStats.flatMap(([key, vi, en, Icon]) => {
    const roles = profile?.roles ?? []
    if (key === "ATTACK_DAMAGE" && roles.includes("MAGE") && !roles.includes("MARKSMAN")) return []
    if (key === "ABILITY_POWER" && !roles.includes("MAGE") && roles.includes("MARKSMAN")) return []
    const stat = hero.content.combatStats?.values?.find((value) => value.statKey === key)
    if (stat?.baseValue == null) return []
    return [{ label: text(vi, en), Icon, value: localizedStatText(statText(stat), locale) }]
  })
  return {
    scope,
    locale,
    text,
    skills,
    active,
    source,
    version,
    videos,
    videoParam,
    selectSkill,
    rich,
    columns,
    tableLabel,
    rows,
    profile,
    facts,
  }
}

type Handbook = ReturnType<typeof useHandbook>

/** The ability picker and the chosen ability. */
function AbilityPanel({ hero, handbook }: { hero: HeroDetail; handbook: Handbook }) {
  const { locale, text, skills, active, source, version, videos } = handbook
  const { selectSkill, rich, columns, tableLabel, rows, profile } = handbook
  // The forms of a slot share one entry in the kit and switch in place, as in the game.
  const groups = groupSkillKit(skills)
  const group = groups.find((entry) => entry.skills.some((skill) => skill.skillKey === active?.skillKey))
  // A state only swaps the picture; it starts from the normal one whenever another skill is shown.
  const [chosenState, setChosenState] = useState<{ skillKey: string; index: number | null }>({
    skillKey: "",
    index: null,
  })
  const state = chosenState.skillKey === active?.skillKey ? chosenState.index : null
  const stateIcons = active?.stateIcons ?? []
  const cooldownRange = active ? skillCooldownRange(active) : null
  const formName = (skill: PublicSkill) => skillFormName(skill, (n) => text(`Biến thể ${n}`, `Form ${n}`))
  if (!active)
    return (
      <p>
        {text("Chưa có kỹ năng được công bố tại phiên bản này.", "No abilities have been published for this version.")}
      </p>
    )
  return (
    <>
      <div className="wiki-skill-options" role="group" aria-labelledby="wiki-kit-title">
        {groups.map((entry) => {
          const chosen = entry.skills.some((skill) => skill.skillKey === active.skillKey)
          const skill = chosen ? active : entry.skills[0]!
          const changed = entry.skills.some((member) => version.changedSkills.has(member.skillKey))
          const hasVideo = entry.skills.some((member) => videos.bySkill.has(member.skillKey))
          const forms = entry.skills.length > 1 ? ` · ${entry.skills.length} ${text("dạng", "forms")}` : ""
          return (
            <button
              type="button"
              key={entry.key}
              aria-label={`${skillLabel(skill, locale)} · ${skill.name || ""}${forms}${changed ? ` · ${text("có thay đổi", "changed")}` : ""}${hasVideo ? text(" · có video", " · has video") : ""}`}
              aria-pressed={chosen}
              onClick={() => selectSkill(skill.skillKey)}
            >
              <SkillIcon hero={hero} skill={skill} locale={locale} />
              <span>
                <small>{skillLabel(skill, locale)}</small>
                <strong>{skill.name || text("Chưa rõ tên", "Unnamed ability")}</strong>
                <SkillVariantDots count={entry.skills.length} active={entry.skills.indexOf(skill)} />
              </span>
              {changed && <i className="wiki-skill-changed" aria-hidden="true" />}
              {hasVideo && <WikiIcon name="play" className="wiki-skill-has-video" />}
            </button>
          )
        })}
      </div>
      <article
        className="wiki-skill-read public-panel wiki-slip"
        aria-label={active.name ?? skillLabel(active, locale)}
      >
        <header className="wiki-edit-heading">
          <div className="wiki-skill-title">
            <span className="wiki-skill-title-icon">
              <SkillIcon
                hero={hero}
                skill={active}
                locale={locale}
                stateAssetId={state === null ? null : stateIcons[state]?.assetId}
              />
            </span>
            <div>
              <span>
                {skillLabel(active, locale)}
                {group && group.skills.length > 1 && formName(active) ? ` · ${formName(active)}` : ""}
              </span>
              <h3>{active.name}</h3>
            </div>
          </div>
          <FeedbackDialog
            target={`${profile?.name ?? hero.code} · ${skillLabel(active, locale)} · ${active.name ?? ""}`}
            identity={`${hero.code}/${active.skillKey}`}
            revision={hero.revisionId}
            fields={[
              { label: text("Mô tả chiêu", "Ability description"), value: active.description ?? "" },
              { label: text("Tên kỹ năng", "Ability name"), value: active.name ?? "" },
              ...rows.map((row) => ({ label: row.label!, value: row.display_values!.join(" / ") })),
            ]}
          />
        </header>
        {group && group.skills.length > 1 && (
          <SkillFormSwitch
            label={text("Dạng của chiêu", "Ability form")}
            value={active.skillKey}
            onChange={selectSkill}
            options={group.skills.map((skill) => ({
              key: skill.skillKey,
              label: formName(skill) || skill.name || skillLabel(skill, locale),
              title: skill.name ?? undefined,
              ariaLabel: `${formName(skill) || skillLabel(skill, locale)} · ${skill.name ?? ""}`,
              icon: (
                <span className="wiki-skill-form-icon">
                  <SkillIcon hero={hero} skill={skill} locale={locale} />
                </span>
              ),
            }))}
          />
        )}
        <div className="wiki-skill-meta">
          {/* The cooldown from the first to the last rank says more than the first rank alone. */}
          {[
            source?.tags,
            cooldownRange ? `${text("Hồi chiêu", "Cooldown")}: ${cooldownRange}` : source?.cooldown?.display,
            source?.energyCost?.display,
          ].map((value, i) => (typeof value === "string" && value.trim() ? <span key={i}>{rich(value)}</span> : null))}
        </div>
        <SkillStateToggle
          states={stateIcons.map((icon) => icon.label)}
          value={state}
          onChange={(index) => setChosenState({ skillKey: active.skillKey, index })}
          normalLabel={text("Thường", "Normal")}
          label={text("Trạng thái của chiêu", "Ability state")}
          unnamed={text("Chưa đặt tên", "Unnamed")}
        />
        <SkillVideos
          skillKey={active.skillKey}
          videos={videos.bySkill.get(active.skillKey) ?? []}
          patchCode={videos.patchCode}
        />
        {active.description ? (
          <div className="wiki-skill-prose" key={active.skillKey}>
            {rich(active.description)}
          </div>
        ) : (
          <p>{text("Chưa có mô tả được công bố.", "No description has been published.")}</p>
        )}
        {columns.length > 0 && rows.length > 0 && (
          <div className="wiki-rank-scroll" tabIndex={0} role="region" aria-label={tableLabel}>
            <table>
              <caption>{tableLabel}</caption>
              <thead>
                <tr>
                  <th scope="col">{text("Thông số", "Stat")}</th>
                  {columns.map((label, i) => (
                    <th scope="col" key={i}>
                      {String(label).replace(/^(?:Lv\.?|Cấp)\s*(\d+)$/i, text("Cấp $1", "Rank $1"))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <th scope="row">{rich(row.label!)}</th>
                    {columns.map((_, j) => (
                      <td key={j}>{row.display_values?.[j] == null ? "—" : rich(String(row.display_values[j]))}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </>
  )
}

/** Who the hero is. */
function OverviewPanel({ hero, handbook }: { hero: HeroDetail; handbook: Handbook }) {
  const { text, rich, profile, facts, videos, videoParam } = handbook
  return (
    <>
      <div className="wiki-edit-heading" id="wiki-hero-overview" tabIndex={-1}>
        <h2>{text("Tổng quan", "Overview")}</h2>
        <FeedbackDialog
          target={`${profile?.name ?? hero.code} · ${text("Tổng quan", "Overview")}`}
          identity={hero.code}
          revision={hero.revisionId}
          fields={[
            { label: text("Giới thiệu", "Summary"), value: profile?.summary ?? "" },
            { label: text("Tên tướng", "Hero name"), value: profile?.name ?? "" },
            { label: text("Cốt truyện", "Lore"), value: profile?.lore ?? "" },
          ]}
        />
      </div>
      {profile?.summary && (
        <OverviewSummary long={profile.summary.length > 140}>{rich(profile.summary)}</OverviewSummary>
      )}
      {hero.content.overviewRatings && <HeroRatings ratings={hero.content.overviewRatings} />}
      {!!facts.length && (
        <dl className="wiki-facts" id="wiki-hero-stats" tabIndex={-1}>
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>
                <fact.Icon size={18} className="wiki-fact-icon" />
                {fact.label}
              </dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {profile?.lore && (
        <details id="wiki-hero-lore" tabIndex={-1}>
          <summary>{text("Cốt truyện", "Lore")}</summary>
          <div className="wiki-skill-prose">{rich(profile.lore)}</div>
        </details>
      )}
      {/* When every video is about the lore, the Videos button beside the hero's role is already this list. */}
      {videos.loreCount > 0 && videos.loreCount < videos.general.length && (
        <button
          type="button"
          className="wiki-handbook-action"
          onClick={() => {
            if (videos.firstLore) videoParam.open(videos.firstLore, "LORE")
            else document.getElementById("hero-videos")?.scrollIntoView({ block: "start" })
          }}
        >
          <WikiIcon name="play" size={18} />
          {text("Video cốt truyện", "Lore videos")} · {videos.loreCount} <WikiIcon name="arrow" size={16} />
        </button>
      )}
    </>
  )
}

/** Going from a change to its ability, on either layout. */
function useAbilityJump({ active, version, selectSkill }: Handbook) {
  // Waits for the chosen skill to render, so the position is measured against the final layout.
  const jumpPending = useRef(false)
  const activeKey = active?.skillKey
  useEffect(() => {
    if (!jumpPending.current) return
    jumpPending.current = false
    scrollToAbilities()
  }, [activeKey])
  const { hash } = useLocation()
  // The changes above the abilities load separately, so a link to the abilities waits for the layout to settle.
  useEffect(() => {
    if (hash === "#wiki-kit-title" && !version.pending)
      document.getElementById("wiki-kit-title")?.scrollIntoView({ block: "start" })
  }, [hash, version.pending])
  return (skillKey: string) => {
    if (skillKey === activeKey) return scrollToAbilities()
    jumpPending.current = true
    selectSkill(skillKey)
  }
}

function HeroVideos({ handbook }: { handbook: Handbook }) {
  const { text, videos } = handbook
  return (
    <VideoGallery
      id="hero-videos"
      videos={videos.general}
      heading={text("Video", "Videos")}
      patchCode={videos.patchCode}
    />
  )
}

/** Wide screens open with the artwork and, beside it, a panel with who the hero is. Compact screens have only the artwork here. */
export function HeroStage({ art, identity, children }: { art: ReactNode; identity: ReactNode; children: ReactNode }) {
  if (usePageLayout() === "compact")
    return (
      <>
        {art}
        {children}
      </>
    )
  return (
    <div className="wiki-hero-stage">
      {art}
      <OrnatePanel className="wiki-hero-stage-panel">
        {identity}
        <OrnateDivider />
        {children}
      </OrnatePanel>
    </div>
  )
}

type HandbookLayoutProps = {
  hero: HeroDetail
  skinOwner?: string
  handbook: Handbook
  art: ReactNode
  identity: ReactNode
  picker: ReactNode
}

/** A list of abilities on the dark ground beside the chosen one, written on a slip of paper. */
function AbilitiesSection({ hero, handbook }: { hero: HeroDetail; handbook: Handbook }) {
  return (
    <section className="wiki-skillbook" aria-labelledby="wiki-kit-title">
      <h2 id="wiki-kit-title" className="wiki-night-title" tabIndex={-1}>
        {handbook.text("Bộ kỹ năng", "Abilities")}
      </h2>
      <AbilityPanel hero={hero} handbook={handbook} />
    </section>
  )
}

function HandbookParts({ hero, skinOwner, handbook }: { hero: HeroDetail; skinOwner?: string; handbook: Handbook }) {
  return (
    <>
      <AbilitiesSection hero={hero} handbook={handbook} />
      <HeroBuilds heroCode={hero.code} />
      <HeroSkins key={hero.id} hero={hero} owner={skinOwner} />
      <HeroVideos handbook={handbook} />
      <HeroHistory hero={hero} version={handbook.version} />
    </>
  )
}

function HandbookWide({ hero, skinOwner, handbook, art, identity, picker }: HandbookLayoutProps) {
  const openSkill = useAbilityJump(handbook)
  return (
    <>
      <HeroStage art={art} identity={identity}>
        <div className="wiki-handbook-profile">
          <OverviewPanel hero={hero} handbook={handbook} />
        </div>
      </HeroStage>
      <div className="wiki-hero-scope">{picker}</div>
      <div className="wiki-handbook">
        <div className="wiki-handbook-main">
          <HeroVersionChanges hero={hero} version={handbook.version} onOpenSkill={openSkill} />
          <HandbookParts hero={hero} skinOwner={skinOwner} handbook={handbook} />
        </div>
        <HeroSectionNav />
      </div>
    </>
  )
}

/**
 * Compact screens: a single column in reading order. What changed in the chosen patch is one line under the patch
 * picker that opens downward, so who the hero is and the abilities follow without a long list between them.
 */
function HandbookCompact({ hero, skinOwner, handbook, art, picker }: HandbookLayoutProps) {
  const openSkill = useAbilityJump(handbook)
  return (
    <>
      {art}
      <div className="wiki-hero-scope">{picker}</div>
      <div className="wiki-handbook wiki-handbook-compact">
        <HeroVersionChanges hero={hero} version={handbook.version} onOpenSkill={openSkill} collapsible />
        <div className="wiki-handbook-profile public-panel wiki-slip">
          <OverviewPanel hero={hero} handbook={handbook} />
        </div>
        <HandbookParts hero={hero} skinOwner={skinOwner} handbook={handbook} />
        <HeroSectionNav />
      </div>
    </>
  )
}

export function HeroHandbook({
  hero,
  skinOwner,
  art,
  identity,
  picker,
}: {
  hero: HeroDetail
  /** The code of the hero that holds this form, whose shared skins the form shows too (ADR-024). */
  skinOwner?: string
  art: ReactNode
  identity: ReactNode
  picker: ReactNode
}) {
  const handbook = useHandbook(hero)
  const props = { hero, skinOwner, handbook, art, identity, picker }
  return usePageLayout() === "compact" ? <HandbookCompact {...props} /> : <HandbookWide {...props} />
}
