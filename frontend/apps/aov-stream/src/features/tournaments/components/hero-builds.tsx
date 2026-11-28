import { useCallback, useState, type CSSProperties } from "react"
import { useQuery } from "@tanstack/react-query"
import type { BuildPart } from "@aov/community-contracts"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { FoldButton } from "../../../components/fold-button"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { capital } from "../../../lib/capital"
import { gamesText } from "../../../lib/feed-words"
import type { HeroRecord } from "../../../lib/hero-model"
import { buildCounts, type BuildCounts, type PartCounts } from "../../../lib/hero-page-model"
import { ENOUGH_FOR_SHARE, shareText } from "../../../lib/shares"
import { heroBuildsQuery } from "../../../lib/tournament-api"
import { nameInitials } from "../../../lib/tournament-model"
import { useFold } from "../../../lib/use-fold"
import { Section } from "./section"
import type { StatsData } from "./stats-data"
import "./hero-builds.css"

/** Parts listed before the reader asks for all of them. */
const ITEMS = { wide: 12, compact: 8 }
const OTHERS = 5
/** How far below the window the builds are asked for. */
const AHEAD = "600px 0px"

/** Whether the reader has come near an element; it stays near from then on. */
function useNear<T extends HTMLElement>() {
  const [near, setNear] = useState(typeof IntersectionObserver === "undefined")
  const place = useCallback((element: T | null) => {
    if (!element || typeof IntersectionObserver === "undefined") return
    const watch = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true)
      },
      { rootMargin: AHEAD },
    )
    watch.observe(element)
    return () => watch.disconnect()
  }, [])
  return { place, near }
}

function PartArt({ part }: { part: BuildPart }) {
  return (
    <span className="tn-hbuild-art" aria-hidden="true">
      {part.iconUrl ? <StreamImage src={part.iconUrl} name="" /> : <b>{nameInitials(part.name)}</b>}
    </span>
  )
}

/** Parts of one kind with the games they were seen in, most often first; the bar is their share of those games. */
function Parts({
  title,
  kind,
  counts: { of, parts },
  limit,
  all,
}: {
  title: string
  /** Which parts they are, for the colour of their bars. */
  kind: string
  counts: PartCounts
  limit: number
  /** Whether the kind is recorded in as many games as any, which the head of the section says already. */
  all: boolean
}) {
  const { text, languageTag } = useStreamLocale()
  const fold = useFold(parts, limit, title)
  if (!parts.length) return null
  return (
    <section className="tn-hbuild-kind" data-kind={kind}>
      <h3>
        {title}
        {!all && <span>{text(`${of} ván có ghi`, `recorded in ${gamesText(of, text, languageTag)}`)}</span>}
      </h3>
      <ul>
        {fold.rows.map(({ part, games }) => (
          <li key={part.id ?? part.name} className="tn-hbuild-part" style={{ "--share": games / of } as CSSProperties}>
            <PartArt part={part} />
            <strong>{part.name}</strong>
            {of > 1 && (
              <span className="tn-hbuild-count">
                <b>{gamesText(games, text, languageTag)}</b>
                {of >= ENOUGH_FOR_SHARE && shareText(games, of)}
              </span>
            )}
            {of >= ENOUGH_FOR_SHARE && <i aria-hidden="true" />}
          </li>
        ))}
      </ul>
      <FoldButton fold={fold} more={text(`Xem cả ${parts.length} món`, `Show all ${parts.length} items`)} />
    </section>
  )
}

/** The kinds of parts that were recorded at all, as the title of the section names them. */
function useTitle({ items, protective, sold, enchantments, spells }: BuildCounts) {
  const { text } = useStreamLocale()
  const kinds = [
    items.of + protective.of + sold.of > 0 && text("trang bị", "items"),
    enchantments.of > 0 && text("phù hiệu", "enchantments"),
    spells.of > 0 && text("phụ trợ", "spells"),
  ].filter((kind) => !!kind)
  return capital(kinds.join(", "))
}

function Builds({ counts, games }: { counts: BuildCounts; games: number }) {
  const { text, languageTag } = useStreamLocale()
  const layout = usePageLayout()
  const title = useTitle(counts)
  const known = counts.games.toLocaleString(languageTag)
  const picked = gamesText(games, text, languageTag)
  const parts = (name: string, key: Exclude<keyof BuildCounts, "games">, limit = OTHERS) => (
    <Parts title={name} kind={key} counts={counts[key]} limit={limit} all={counts[key].of === counts.games} />
  )
  return (
    <Section
      id="hero-builds"
      title={title}
      note={text(`${known} trong ${picked} có ghi`, `recorded in ${known} of ${picked}`)}
    >
      <div className="tn-hbuild">
        {parts(text("Trang bị chính", "Core items"), "items", ITEMS[layout])}
        <div className="tn-hbuild-rest">
          {parts(text("Bảo hộ", "Protective items"), "protective")}
          {parts(text("Hay bán để đổi món", "Often sold for another"), "sold")}
          {parts(text("Phù hiệu chính", "Main enchantment"), "enchantments")}
          {parts(text("Phụ trợ", "Spell"), "spells")}
        </div>
      </div>
    </Section>
  )
}

/**
 * What a hero was played with: the items, the main enchantment and the spell of its builds, asked for when the reader
 * comes near. Nothing shows where the games record none of it.
 */
export function HeroBuildsPart({ data, record: { hero, picks } }: { data: StatsData; record: HeroRecord }) {
  const { text } = useStreamLocale()
  const { place, near } = useNear<HTMLDivElement>()
  const wanted = !!hero.id && picks.length > 0
  const query = useQuery({ ...heroBuildsQuery(data.view.id, hero.id ?? ""), enabled: wanted && near })
  if (!wanted) return null
  if (query.isPending)
    return (
      <div
        className="tn-hbuild-wait"
        ref={place}
        role="status"
        aria-label={text("Đang tải trang bị…", "Loading builds…")}
      >
        <span className="hub-skeleton" />
      </div>
    )
  if (query.isLoadingError)
    return (
      <p className="tn-quiet" role="alert">
        {text("Chưa tải được trang bị của tướng này.", "The builds of this hero could not be loaded.")}{" "}
        <button type="button" onClick={() => void query.refetch()}>
          {text("Thử lại", "Retry")}
        </button>
      </p>
    )
  const games = new Set(picks.map(({ game }) => game.id))
  const counts = buildCounts(query.data!, games)
  return counts.games > 0 ? <Builds counts={counts} games={games.size} /> : null
}
