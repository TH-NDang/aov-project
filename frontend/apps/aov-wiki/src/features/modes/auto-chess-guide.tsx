import { useMemo } from "react"
import { useSearchParams } from "react-router"
import { useWikiContext } from "../../context/wiki-context"
import { TRAIT_KIND_LABEL } from "./auto-chess-model"
import type { PublicGuide } from "./mode-api"
import { formatDay, ModeDialog } from "./mode-ui"
import { GuideLinks, useGuideIndex, type GuideIndex } from "./guide-ui"
import { UnitDetail, UnitsTab } from "./guide-units"
import { TraitsTab } from "./guide-traits"
import { ItemsTab } from "./guide-items"
import { BlessingsTab } from "./guide-blessings"
import { QuestsTab } from "./guide-quests"
import { LineupsTab } from "./guide-lineups"
import { BuilderTab } from "./guide-builder"
import { InsightsTab } from "./guide-insights"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"

export const GUIDE_TABS = [
  { key: "tong-quan", label: "Tổng quan" },
  { key: "quan-co", label: "Quân cờ" },
  { key: "phe-nghe", label: "Phe & Nghề" },
  { key: "trang-bi", label: "Trang bị" },
  { key: "chuc-phuc", label: "Chúc phúc" },
  { key: "nhiem-vu", label: "Nhiệm vụ" },
  { key: "doi-hinh", label: "Đội hình" },
  { key: "xep-doi-hinh", label: "Xếp đội hình" },
  { key: "phan-tich", label: "Phân tích" },
] as const

export type GuideTab = (typeof GUIDE_TABS)[number]["key"]

const plain = (value?: string | null) => (value ?? "").replace(/<[^>]+>/g, "")

/**
 * The guide's own traits, units and items as references, so a name in a description gets a card like a term does.
 * Each points at its place in the guide.
 */
function guideReferences(index: GuideIndex, modeCode: string, href: (path: string) => string): EntityReference[] {
  const base = `/modes/${encodeURIComponent(modeCode)}`
  const translation = (name: string, description: string) => [{ locale: "vi-VN", name, aliases: [], description }]
  return [
    ...index.content.traits.map((trait) => ({
      id: `guide-trait-${trait.code}`,
      kind: "term" as const,
      translations: translation(
        trait.name,
        [
          `${TRAIT_KIND_LABEL[trait.kind]} · ${index.membersOf(trait.code).length} quân cờ`,
          ...trait.tiers.map((tier) => `(${tier.count}) ${plain(tier.effect)}`),
        ].join("\n"),
      ),
      icon: index.image(trait.iconAssetId) ?? null,
      autoMatch: true,
      destinations: { wiki: href(`${base}/phe-nghe?trait=${encodeURIComponent(trait.code)}`) },
    })),
    ...index.content.units.map((unit) => ({
      id: `guide-unit-${unit.code}`,
      kind: "term" as const,
      translations: translation(
        unit.name,
        [
          `Quân cờ ${unit.cost} vàng · ${unit.traitCodes.map((code) => index.traits.get(code)?.name).join(", ")}`,
          unit.skill?.name ? `${unit.skill.name}: ${plain(unit.skill.description)}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ),
      icon: index.image(unit.portraitAssetId) ?? null,
      autoMatch: false,
      destinations: { wiki: href(`${base}/quan-co?unit=${encodeURIComponent(unit.code)}`) },
    })),
    ...index.content.items.map((item) => ({
      id: `guide-item-${item.code}`,
      kind: "term" as const,
      translations: translation(item.name, `Trang bị Cờ Liên quân · ${plain(item.effect)}`),
      icon: index.image(item.iconAssetId) ?? null,
      autoMatch: true,
      destinations: { wiki: href(`${base}/trang-bi`) },
    })),
  ]
}

export function AutoChessGuide({ code, tab, guide }: { code: string; tab: GuideTab; guide: PublicGuide }) {
  const index = useGuideIndex(guide)
  const { href } = useWikiContext()
  const links = useMemo(
    () => ({
      entities: guideReferences(index, code, href),
      traitHref: (traitCode: string) =>
        href(`/modes/${encodeURIComponent(code)}/phe-nghe?trait=${encodeURIComponent(traitCode)}`),
    }),
    [index, code, href],
  )
  const [params, setParams] = useSearchParams()
  const openUnit = params.get("unit")
  const selected = openUnit ? index.units.get(openUnit) : undefined
  const showUnit = (unitCode: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (unitCode) next.set("unit", unitCode)
        else next.delete("unit")
        return next
      },
      { preventScrollReset: true },
    )

  return (
    <GuideLinks.Provider value={links}>
      {tab === "quan-co" && <UnitsTab index={index} onOpen={showUnit} />}
      {tab === "phe-nghe" && <TraitsTab index={index} onOpen={showUnit} />}
      {tab === "trang-bi" && <ItemsTab index={index} />}
      {tab === "chuc-phuc" && <BlessingsTab index={index} />}
      {tab === "nhiem-vu" && <QuestsTab index={index} />}
      {tab === "doi-hinh" && <LineupsTab code={code} guide={guide} index={index} onOpen={showUnit} />}
      {tab === "xep-doi-hinh" && <BuilderTab code={code} index={index} onOpen={showUnit} />}
      {tab === "phan-tich" && <InsightsTab code={code} index={index} onOpen={showUnit} />}
      {/* Where the data comes from closes every tab, out of the way of what the reader came for. */}
      <p className="guide-edition">
        {guide.content.edition ?? "Bách khoa Cờ Liên quân"}
        {guide.content.observedOn && ` · ghi nhận ${formatDay(guide.content.observedOn)}`} · Dữ liệu và hình ảnh: Garena
        / Liên Quân Mobile
      </p>
      <ModeDialog open={!!selected} onClose={() => showUnit(null)} label={selected?.name ?? "Quân cờ"} title="Quân cờ">
        {selected && <UnitDetail unit={selected} index={index} code={code} onOpen={showUnit} />}
      </ModeDialog>
    </GuideLinks.Provider>
  )
}
