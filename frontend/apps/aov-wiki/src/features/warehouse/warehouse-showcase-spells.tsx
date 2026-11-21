import { useMemo, type CSSProperties } from "react"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { isRetiredSpell, spellRows } from "./use-item-catalog"
import { useShowcaseTurn } from "./use-showcase-turn"
import { WarehouseShowcase, type ShowcaseIntro } from "./warehouse-showcase"
import { spellCooldownText, spellKeepsCharges } from "./warehouse-spells"
import { warehouseImage, warehouseName, type PublishedWarehouseRecord } from "../../lib/warehouse-types"
import "./warehouse-showcase-spells.css"

interface SpellScene {
  key: string
  url: string
  name: string
  cooldown: number | null
  /** What a talent that keeps several charges says about them. */
  charges: string | null
}

/**
 * The talents' head, drawn as a talent coming off cooldown in a match: one talent large in the middle, a dark sweep
 * turning off it clockwise until it is ready and lights up, and the other talents on a slow ring around it. Each
 * talent takes its turn, and the caption names it with its cooldown.
 */
export function SpellShowcase({ intro, entries }: { intro: ShowcaseIntro; entries: PublishedWarehouseRecord[] }) {
  const { locale } = useWikiContext()
  const scenes = useMemo(
    () =>
      spellRows(entries, locale)
        .filter((entry) => !isRetiredSpell(entry))
        .flatMap((entry): SpellScene[] => {
          const url = warehouseImage(entry)
          return url
            ? [
                {
                  key: entry.code,
                  url,
                  name: warehouseName(entry, locale),
                  cooldown: entry.content.cooldownSeconds,
                  charges: spellKeepsCharges(entry.content)
                    ? wikiText(
                        locale,
                        `Tích trữ ${entry.content.maxCharges} lần`,
                        `${entry.content.maxCharges} charges`,
                      )
                    : null,
                },
              ]
            : []
        }),
    [entries, locale],
  )
  const { scene, leaving } = useShowcaseTurn(scenes, picturesOfScene)
  const others = scene ? scenes.filter((candidate) => candidate.key !== scene.key) : []
  return (
    <WarehouseShowcase
      {...intro}
      scene={
        scene && (
          <div key={scene.key} className="wiki-spell-scene" data-leaving={leaving || undefined}>
            <div className="wiki-spell-scene-ring">
              {others.map((other, index) => (
                <img
                  key={other.key}
                  className="wiki-spell-scene-orbit"
                  src={other.url}
                  alt=""
                  decoding="async"
                  style={{ "--turn": `${(index * 360) / others.length}deg` } as CSSProperties}
                />
              ))}
            </div>
            <span className="wiki-spell-scene-hero">
              <img src={scene.url} alt="" decoding="async" />
              <span className="wiki-spell-scene-sweep" />
            </span>
          </div>
        )
      }
      caption={
        scene && (
          // The caption changes with the scene every few seconds, so it is not read out each time.
          <p className="wiki-spell-scene-caption" data-leaving={leaving || undefined} aria-hidden="true">
            <b>{scene.name}</b>
            <span>
              {wikiText(locale, "Hồi chiêu", "Cooldown")} {spellCooldownText(scene.cooldown, locale)}
            </span>
            {scene.charges && <span>{scene.charges}</span>}
          </p>
        )
      }
    />
  )
}

function picturesOfScene(scene: SpellScene) {
  return [scene.url]
}
