import { useState } from "react"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { BLESSING_TIER_NAMES, foldText, type Blessing } from "./auto-chess-model"
import { ModeHeading } from "./mode-ui"
import { BlessingIcon, GuideSearch, GuideText, TIER_STYLE, type GuideIndex } from "./guide-ui"

const BLESSING_TIERS = ["NORMAL", "EPIC", "LEGENDARY"] as const

/**
 * A mark per blessing tier, drawn in the tier's color: a gem for the normal tier, a crest for epic, a crown for
 * legendary, so the tier reads before its name.
 */
function TierIcon({ tier, size = 18 }: { tier: Blessing["tier"]; size?: number }) {
  return (
    <svg
      className="tier-icon"
      style={TIER_STYLE[tier]}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      {tier === "NORMAL" && (
        <>
          <path d="M10 2.2 16.6 8 10 17.8 3.4 8Z" fill="currentColor" />
          <path d="M3.4 8h13.2M7 8l3 9.8L13 8m-6 0 3-5.8L13 8" fill="none" stroke="#fff" strokeOpacity=".55" />
        </>
      )}
      {tier === "EPIC" && (
        <>
          <path d="M10 1.8 16.8 5.6v8.8L10 18.2 3.2 14.4V5.6Z" fill="currentColor" />
          <path
            d="m10 5.4 1.3 3.1 3.3.3-2.5 2.2.8 3.3L10 12.6l-2.9 1.7.8-3.3-2.5-2.2 3.3-.3Z"
            fill="#fff"
            fillOpacity=".85"
          />
        </>
      )}
      {tier === "LEGENDARY" && (
        <>
          <path d="M2.6 6.4 6.6 9.6 10 3.4l3.4 6.2 4-3.2-1.6 9H4.2Z" fill="currentColor" />
          <path d="M4.2 17.4h11.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="10" cy="11.6" r="1.6" fill="#fff" fillOpacity=".85" />
        </>
      )}
    </svg>
  )
}

/** Blessings by tier, each a row with the game's card icon; a search and one chip per tier narrow them. */
export function BlessingsTab({ index }: { index: GuideIndex }) {
  const compact = usePageLayout() === "compact"
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const [tier, setTier] = useState<Blessing["tier"] | null>(null)
  const [search, setSearch] = useState("")
  const needle = foldText(search.trim())
  const matches = (blessing: Blessing) =>
    !needle || foldText(`${blessing.name} ${blessing.description ?? ""}`).includes(needle)
  const sections = BLESSING_TIERS.filter((value) => !tier || tier === value)
    .map((value) => ({
      tier: value,
      blessings: index.content.blessings.filter((blessing) => blessing.tier === value && matches(blessing)),
    }))
    .filter((section) => section.blessings.length)
  return (
    <section className="guide-tab-body" aria-label={text("Chúc phúc", "Blessings")}>
      <div className="guide-toolbar" data-stack={compact || undefined}>
        <GuideSearch
          value={search}
          onChange={setSearch}
          label={text("Tìm chúc phúc", "Search blessings")}
          placeholder="Tìm tên, hiệu ứng…"
        />
        <div className="mode-chip-row" role="group" aria-label={text("Bậc chúc phúc", "Blessing tiers")}>
          {BLESSING_TIERS.map((value) => (
            <button
              key={value}
              type="button"
              className="mode-chip"
              aria-pressed={tier === value}
              onClick={() => setTier(tier === value ? null : value)}
            >
              <TierIcon tier={value} />
              {text(...BLESSING_TIER_NAMES[value])}
              <small>{index.content.blessings.filter((blessing) => blessing.tier === value).length}</small>
            </button>
          ))}
        </div>
      </div>
      {sections.map((section) => (
        <section key={section.tier} className="mode-section" aria-labelledby={`blessing-tier-${section.tier}`}>
          <ModeHeading
            id={`blessing-tier-${section.tier}`}
            title={text(...BLESSING_TIER_NAMES[section.tier])}
            count={section.blessings.length}
            icon={<TierIcon tier={section.tier} size={20} />}
          />
          <ul className="guide-entries" data-columns="3">
            {section.blessings.map((blessing) => (
              <li key={blessing.code} className="guide-entry">
                <BlessingIcon blessing={blessing} index={index} />
                <div>
                  <h3>{blessing.name}</h3>
                  {blessing.description && (
                    <p>
                      <GuideText text={blessing.description} />
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!sections.length && (
        <p className="mode-empty">Không có chúc phúc khớp “{search.trim()}”. Thử tên khác hoặc bỏ chọn bậc.</p>
      )}
    </section>
  )
}
