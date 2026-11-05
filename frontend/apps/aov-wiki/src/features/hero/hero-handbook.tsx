import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { EntityRichText } from "@aov/ui/components/entity-rich-text"
import { gameplayIcons } from "@aov/ui/components/gameplay-icons"
import { createEntityIndex } from "@aov/ui/lib/entity-rich-text"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { WikiIcon } from "../../components/wiki-icon"
import { WikiImage } from "../../components/wiki-image"
import { FeedbackDialog } from "../../layout/feedback-dialog"
import { HeroHistory } from "./hero-history"
import { HeroVersionChanges, useHeroVersion } from "./hero-version-changes"
import type { DiffSegment } from "./hero-version-diff"
import { HeroRatings } from "./hero-ratings"
import { skillIllustration } from "./skill-illustration"
import { wikiReferencesQuery } from "../../lib/wiki-references"
import type { HeroDetail, PublicSkill } from "./hero-api"
import "./hero-handbook.css"

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

function SkillIcon({ hero, skill, locale }: { hero: HeroDetail; skill: PublicSkill; locale: string }) {
  const [failed, setFailed] = useState<string[]>([])
  const bound = hero.skillMedia?.[skill.skillKey]?.currentVersion?.url
  const reference = skillIllustration(hero.code, skill)
  const url = [bound, reference].find((value): value is string => !!value && !failed.includes(value))
  if (!url) return <WikiIcon name={skill.kind === "PASSIVE" ? "spark" : "items"} size={20} />
  return (
    <WikiImage
      src={url}
      alt=""
      width={36}
      height={36}
      title={
        url === bound
          ? undefined
          : wikiText(locale, "Ảnh tham khảo · Garena / Liên Quân Mobile", "Reference artwork · Garena / Arena of Valor")
      }
      onError={() => setFailed((previous) => [...previous, url])}
    />
  )
}

function DiffText({ segments }: { segments: DiffSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === "del" ? (
          <del key={index}>{segment.text}</del>
        ) : segment.kind === "ins" ? (
          <ins key={index}>{segment.text}</ins>
        ) : (
          segment.text
        ),
      )}
    </>
  )
}

export function HeroHandbook({ hero }: { hero: HeroDetail }) {
  const scope = useWikiContext()
  const { locale, href } = scope
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const [params, setParams] = useSearchParams()
  const skills = [...(hero.content.skills?.skills ?? [])].sort((a, b) => a.displayOrder - b.displayOrder)
  const active = skills.find((skill) => skill.skillKey === params.get("skill")) ?? skills[0]
  const source = active?.effects?.find((effect) => effect.effectType === "SOURCE_SNAPSHOT")?.metadata
  const version = useHeroVersion(hero)
  const difference =
    version.showDiff && active && !version.differences.skills.get(active.skillKey)?.isNew
      ? version.differences.skills.get(active.skillKey)
      : undefined
  const selectSkill = (skillKey: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set("skill", skillKey)
        return next
      },
      { replace: true, preventScrollReset: true },
    )
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
    const change = version.showDiff ? version.differences.stats.get(key) : undefined
    return [
      {
        label: text(vi, en),
        Icon,
        value: stat.baseValue.toLocaleString(locale),
        before: change ? Number(change.before).toLocaleString(locale) : undefined,
      },
    ]
  })
  return (
    <div className="wiki-handbook">
      <section className="wiki-handbook-kit" aria-labelledby="wiki-kit-title">
        <HeroVersionChanges hero={hero} version={version} onSelectSkill={selectSkill} />
        <h2 id="wiki-kit-title">{text("Bộ kỹ năng", "Abilities")}</h2>
        {active ? (
          <>
            <div className="wiki-skill-options" role="group" aria-labelledby="wiki-kit-title">
              {skills.map((skill) => {
                return (
                  <button
                    type="button"
                    key={skill.skillKey}
                    aria-label={`${skillLabel(skill, locale)} · ${skill.name || ""}${version.changedSkills.has(skill.skillKey) ? ` · ${text("có thay đổi", "changed")}` : ""}`}
                    aria-pressed={skill.skillKey === active.skillKey}
                    onClick={() => selectSkill(skill.skillKey)}
                  >
                    <SkillIcon hero={hero} skill={skill} locale={locale} />
                    <span>
                      <small>{skillLabel(skill, locale)}</small>
                      <strong>{skill.name || text("Chưa rõ tên", "Unnamed ability")}</strong>
                    </span>
                    {version.changedSkills.has(skill.skillKey) && (
                      <i className="wiki-skill-changed" aria-hidden="true" />
                    )}
                  </button>
                )
              })}
            </div>
            <article className="wiki-skill-read" aria-label={active.name ?? skillLabel(active, locale)}>
              <header className="wiki-edit-heading">
                <div>
                  <span>{skillLabel(active, locale)}</span>
                  <h3>{active.name}</h3>
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
              <div className="wiki-skill-meta">
                {[source?.tags, source?.cooldown?.display, source?.energyCost?.display].map((value, i) =>
                  typeof value === "string" && value.trim() ? <span key={i}>{rich(value)}</span> : null,
                )}
                {difference?.cooldown && (
                  <span>
                    {text("Trước đây", "Before")}: <del>{difference.cooldown.before}</del>
                  </span>
                )}
                {difference?.energyCost && (
                  <span>
                    {text("Trước đây", "Before")}: <del>{difference.energyCost.before}</del>
                  </span>
                )}
              </div>
              {difference && version.previous && (
                <p className="wiki-diff-legend">
                  {text("Đang đánh dấu khác biệt so với bản", "Marking differences from")} {version.previous.code}:{" "}
                  <del>{text("nội dung cũ", "old text")}</del> <ins>{text("nội dung mới", "new text")}</ins>
                </p>
              )}
              {difference?.description ? (
                <div className="wiki-skill-prose">
                  <DiffText segments={difference.description} />
                </div>
              ) : active.description ? (
                <div className="wiki-skill-prose">{rich(active.description)}</div>
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
                            <td key={j}>
                              {difference?.rows.get(row.label!) &&
                                difference.rows.get(row.label!)!.before[j] !==
                                  difference.rows.get(row.label!)!.after[j] && (
                                  <del className="wiki-diff-cell">
                                    {difference.rows.get(row.label!)!.before[j] ?? "—"}
                                  </del>
                                )}
                              {row.display_values?.[j] == null ? "—" : rich(String(row.display_values[j]))}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </>
        ) : (
          <p>
            {text(
              "Chưa có kỹ năng được công bố tại phiên bản này.",
              "No abilities have been published for this version.",
            )}
          </p>
        )}
        <HeroHistory hero={hero} version={version} />
      </section>
      <aside className="wiki-handbook-profile">
        <div className="wiki-edit-heading">
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
        {profile?.summary && <div className="wiki-skill-prose">{rich(profile.summary)}</div>}
        {hero.content.overviewRatings && <HeroRatings ratings={hero.content.overviewRatings} />}
        {!!facts.length && (
          <dl className="wiki-facts">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt>
                  <fact.Icon size={18} className="wiki-fact-icon" />
                  {fact.label}
                </dt>
                <dd>
                  {fact.before && <del className="wiki-diff-cell">{fact.before}</del>}
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {profile?.lore && (
          <details>
            <summary>{text("Cốt truyện", "Lore")}</summary>
            <div className="wiki-skill-prose">{rich(profile.lore)}</div>
          </details>
        )}
        <Link className="wiki-handbook-skins" to={href(`/skins?hero=${encodeURIComponent(hero.code)}`)}>
          <WikiIcon name="skin" size={18} />
          {text("Trang phục của tướng", "Browse hero skins")} <WikiIcon name="arrow" size={16} />
        </Link>
      </aside>
    </div>
  )
}
