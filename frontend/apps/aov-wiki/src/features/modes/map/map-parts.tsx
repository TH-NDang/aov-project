import { useWikiText } from "../../../context/wiki-context"
import type { ModeImage } from "../auto-chess-model"
import { ObjectIcon } from "./map-board"
import { LaneMark } from "@aov/ui/components/battle-map-glyph"
import {
  CATEGORIES,
  CATEGORY_NAMES,
  clock,
  heads,
  spawnClock,
  MAP_TABS,
  type Category,
  type MapContent,
  type MapLane,
  type MapTab,
  type TempoMoment,
} from "@aov/ui/lib/battle-map"
import "./map-parts.css"

const TAB_NAMES: Record<MapTab, readonly [string, string]> = {
  map: ["Bản đồ", "Map"],
  lanes: ["Đường", "Lanes"],
  tempo: ["Nhịp điệu", "Tempo"],
}

/** The game's three tabs: the map, the lanes and the match tempo. */
export function MapTabs({ active, onChoose }: { active: MapTab; onChoose: (tab: MapTab) => void }) {
  const text = useWikiText()
  return (
    <div className="wiki-map-tabs" role="tablist" aria-label={text("Bách khoa chiến trường", "Battlefield guide")}>
      {MAP_TABS.map((tab) => (
        <button
          type="button"
          role="tab"
          key={tab}
          aria-selected={tab === active}
          className="wiki-map-tab"
          onClick={() => onChoose(tab)}
        >
          {text(...TAB_NAMES[tab])}
        </button>
      ))}
    </div>
  )
}

/** Chips that show or hide each kind of object, and the areas' outlines. */
export function MapLayers({
  content,
  shown,
  onShown,
  showAreas,
  onShowAreas,
}: {
  content: MapContent
  shown: ReadonlySet<Category>
  onShown: (shown: ReadonlySet<Category>) => void
  showAreas: boolean
  onShowAreas: (on: boolean) => void
}) {
  const text = useWikiText()
  const present = CATEGORIES.filter((category) => heads(content).some((object) => object.category === category))
  const toggle = (category: Category) => {
    const next = new Set(shown)
    if (next.has(category)) next.delete(category)
    else next.add(category)
    onShown(next)
  }
  return (
    <div className="wiki-map-layers" role="group" aria-label={text("Hiện trên bản đồ", "Shown on the map")}>
      {present.map((category) => (
        <button
          type="button"
          key={category}
          className="wiki-map-layer"
          data-category={category}
          aria-pressed={shown.has(category)}
          onClick={() => toggle(category)}
        >
          {text(...CATEGORY_NAMES[category])}
        </button>
      ))}
      {content.areas.length > 0 && (
        <button
          type="button"
          className="wiki-map-layer"
          data-category="AREA"
          aria-pressed={showAreas}
          onClick={() => onShowAreas(!showAreas)}
        >
          {text("Khu vực", "Areas")}
        </button>
      )}
    </div>
  )
}

/**
 * Every object by kind, for readers who look for one by name. Wide screens list them in the panel; phones swipe each
 * kind sideways under the map.
 */
export function MapIndex({
  content,
  images,
  shown,
  onPick,
}: {
  content: MapContent
  images: Record<string, ModeImage>
  shown: ReadonlySet<Category>
  onPick: (ref: string) => void
}) {
  const text = useWikiText()
  const groups = CATEGORIES.filter((category) => shown.has(category))
    .map((category) => ({
      category,
      objects: content.objects.filter((object) => object.category === category),
    }))
    .filter((group) => group.objects.length > 0)
  return (
    <nav className="wiki-map-index" aria-label={text("Danh sách", "All places")}>
      {groups.map(({ category, objects }) => (
        <section key={category} className="wiki-map-index-group" aria-labelledby={`wiki-map-index-${category}`}>
          <h2 id={`wiki-map-index-${category}`} className="wiki-frame-divider">
            {text(...CATEGORY_NAMES[category])}
          </h2>
          <ul>
            {objects.map((object) => {
              const first = spawnClock(object.firstSpawn)
              return (
                <li key={object.code}>
                  <button type="button" className="wiki-map-index-entry" onClick={() => onPick(object.code)}>
                    <span className="wiki-map-index-icon" data-category={object.category}>
                      <ObjectIcon object={object} images={images} size={20} />
                    </span>
                    <span className="wiki-map-index-name">{object.name}</span>
                    {first && <span className="wiki-map-index-time">{first}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </nav>
  )
}

/** The lanes and roles of the "Lanes" tab as a row of plates. */
export function LaneChooser({
  lanes,
  chosen,
  onPick,
}: {
  lanes: MapLane[]
  chosen: string | null
  onPick: (code: string) => void
}) {
  const text = useWikiText()
  return (
    <div className="wiki-map-lanes" role="group" aria-label={text("Đường và vai trò", "Lanes and roles")}>
      {lanes.map((lane) => (
        <button
          type="button"
          key={lane.code}
          className="wiki-map-lane-choice"
          aria-pressed={lane.code === chosen}
          onClick={() => onPick(lane.code)}
        >
          <LaneMark glyph={lane.glyph} size={18} />
          {lane.name}
        </button>
      ))}
    </div>
  )
}

/** The note that a mark of the timeline has come, laid over the map while the clock runs. */
export function MapReminder({
  moment,
  onOpen,
  onClose,
}: {
  moment: TempoMoment
  onOpen: () => void
  onClose: () => void
}) {
  const text = useWikiText()
  const labels = moment.callouts.map((callout) => callout.label)
  return (
    <div className="wiki-map-reminder" role="status">
      <button type="button" className="wiki-map-reminder-body" onClick={onOpen}>
        <strong>{clock(moment.seconds)}</strong>
        <span>{labels.length ? labels.join(" · ") : (moment.phase ?? text("Mốc mới", "New mark"))}</span>
      </button>
      <button
        type="button"
        className="wiki-map-reminder-close"
        aria-label={text("Ẩn nhắc", "Hide reminder")}
        onClick={onClose}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  )
}
