import { useMemo, useState, type ReactNode } from "react"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate, useSearchParams } from "react-router"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/public-overlay"
import { WikiIcon } from "../../components/wiki-icon"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useWikiContext } from "../../context/wiki-context"
import { signIn, useWikiSession } from "../auth/wiki-auth"
import {
  decodeLineup,
  DIFFICULTY_LABEL,
  encodeLineup,
  MAX_EMBLEMS,
  BOARD_SLOTS,
  MAX_LINEUP_UNITS,
  ROW_LABEL,
  cellOf,
  suggestUnits,
  traitCounts,
  type BoardRow,
  type BuilderUnit,
  type Lineup,
  type LineupUnit,
} from "./auto-chess-model"
import {
  BoardGrid,
  BoardPiece,
  LineupBoard,
  LineupViewSwitch,
  placeUnits,
  useLineupView,
  type LineupView,
} from "./lineup-board"
import {
  BlessingIcon,
  CostChips,
  TraitFilter,
  costStyle,
  TIER_STYLE,
  TraitIcon,
  TraitTag,
  UnitPortrait,
  type GuideIndex,
} from "./auto-chess-guide"
import { ModeDialog, ModeFab } from "./mode-ui"
import {
  communityLineupsQuery,
  deleteLineup,
  insightsQuery,
  lineupErrorMessage,
  myStateQuery,
  saveLineup,
  setLike,
  type LineupSort,
  type PublicGuide,
} from "./mode-api"

const TIER_ORDER: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 }

/** Likes of the signed-in reader, with the server's answer applied right away. */
function useLikes(code: string) {
  const session = useWikiSession()
  const me = useQuery({ ...myStateQuery(code, session.revision), enabled: session.status === "authenticated" })
  const client = useQueryClient()
  const [overrides, setOverrides] = useState<Record<string, { liked: boolean; likes: number }>>({})
  const [message, setMessage] = useState("")
  const toggle = useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) => setLike(code, id, liked),
    onSuccess: (result) => {
      setMessage("")
      setOverrides((current) => ({ ...current, [result.lineupId]: { liked: result.liked, likes: result.likes } }))
      void client.invalidateQueries({ queryKey: ["wiki", "game-mode", code, "insights"] })
    },
    onError: (error) => setMessage(lineupErrorMessage(error)),
  })
  return {
    session,
    me,
    message,
    pending: toggle.isPending ? toggle.variables?.id : undefined,
    liked: (id: string) => overrides[id]?.liked ?? me.data?.likedLineupIds.includes(id) ?? false,
    likes: (id: string, base: number) => overrides[id]?.likes ?? base,
    toggle: (id: string, liked: boolean) => toggle.mutate({ id, liked }),
  }
}

type Likes = ReturnType<typeof useLikes>

function LikeButton({ id, base, likes, own }: { id: string; base: number; likes: Likes; own?: boolean }) {
  const count = likes.likes(id, base)
  if (likes.session.status !== "authenticated")
    return (
      <button type="button" className="mode-chip" onClick={() => void signIn()} title="Đăng nhập để thích">
        ♡ {count}
      </button>
    )
  const liked = likes.liked(id)
  return (
    <button
      type="button"
      className="mode-chip like-button"
      aria-pressed={liked}
      disabled={own || likes.pending === id}
      title={own ? "Đội hình của bạn" : liked ? "Bỏ thích" : "Thích đội hình này"}
      onClick={() => likes.toggle(id, !liked)}
    >
      {liked ? "♥" : "♡"} {count}
    </button>
  )
}

function LineupUnits({
  units,
  index,
  onOpen,
}: {
  units: LineupUnit[]
  index: GuideIndex
  onOpen: (code: string) => void
}) {
  const shown = units.filter((item) => index.units.has(item.unitCode))
  return (
    <div className="lineup-units" aria-label={`${Math.min(shown.length, BOARD_SLOTS)}/${BOARD_SLOTS} ô`}>
      {shown.map((item, at) => {
        const unit = index.units.get(item.unitCode)!
        const extra = at >= BOARD_SLOTS
        return (
          <button
            key={item.unitCode}
            type="button"
            className="lineup-unit"
            data-carry={item.carry}
            data-extra={extra || undefined}
            style={costStyle(unit.cost)}
            title={`${unit.name}${item.row ? ` · ${ROW_LABEL[item.row]}` : ""}${item.carry ? " · chủ lực" : ""}${extra ? " · ô thêm từ trang bị" : ""}`}
            onClick={() => onOpen(unit.code)}
          >
            <span className="lineup-portrait">
              <UnitPortrait unit={unit} index={index} size="md" />
              {item.carry && (
                <em className="carry-mark" title="Chủ lực" aria-label="Chủ lực">
                  M
                </em>
              )}
            </span>
            <span>{unit.name}</span>
            {item.itemCodes.length > 0 && (
              <span className="lineup-items">
                {item.itemCodes.map((code) => {
                  const entry = index.items.get(code)
                  const src = index.image(entry?.iconAssetId)
                  return src ? <img key={code} src={src} alt={entry?.name ?? ""} title={entry?.name ?? code} /> : null
                })}
              </span>
            )}
          </button>
        )
      })}
      {Array.from({ length: Math.max(0, BOARD_SLOTS - shown.length) }, (_, at) => (
        <span key={`empty-${at}`} className="lineup-slot-empty" aria-hidden="true" />
      ))}
    </div>
  )
}

/** The board when the lineup places at least one unit and the reader chose it; the list otherwise. */
function LineupPieces({
  units,
  view,
  index,
  onOpen,
}: {
  units: LineupUnit[]
  view: LineupView
  index: GuideIndex
  onOpen: (code: string) => void
}) {
  return view === "board" && units.some((unit) => cellOf(unit)) ? (
    <LineupBoard units={units} index={index} onOpen={onOpen} />
  ) : (
    <LineupUnits units={units} index={index} onOpen={onOpen} />
  )
}

function ActiveTraits({ units, emblems, index }: { units: LineupUnit[]; emblems: string[]; index: GuideIndex }) {
  const counts = traitCounts(
    index.content,
    units.map((unit) => unit.unitCode),
    emblems,
  ).filter((count) => count.reachedTier >= 0)
  if (!counts.length) return null
  return (
    <div className="guide-trait-tags">
      {counts.map((count) => (
        <span
          key={count.trait.code}
          className="guide-trait-tag"
          data-active="true"
          title={count.trait.tiers[count.reachedTier]?.effect}
        >
          <TraitIcon trait={count.trait} index={index} size={18} />
          <b>{count.count}</b>
          {count.trait.name}
        </span>
      ))}
    </div>
  )
}

export function LineupsTab({
  code,
  guide,
  index,
  onOpen,
}: {
  code: string
  guide: PublicGuide
  index: GuideIndex
  onOpen: (code: string) => void
}) {
  const { href } = useWikiContext()
  const likes = useLikes(code)
  const [view, setView] = useLineupView()
  const [sort, setSort] = useState<LineupSort>("popular")
  const [unit, setUnit] = useState<string | null>(null)
  const community = useInfiniteQuery(communityLineupsQuery(code, sort, unit))
  const communityLineups = community.data?.pages.flatMap((page) => page.items) ?? []
  const communityTotal = community.data?.pages[0]?.totalElements ?? 0
  const own = new Set(likes.me.data?.lineups.map((lineup) => lineup.id))
  const editorial = [...guide.content.lineups].sort(
    (a, b) =>
      (TIER_ORDER[a.tier ?? ""] ?? 9) - (TIER_ORDER[b.tier ?? ""] ?? 9) ||
      (guide.lineupLikes[b.id]?.likes ?? 0) - (guide.lineupLikes[a.id]?.likes ?? 0),
  )
  const builderLink = (units: LineupUnit[], emblems: string[]) =>
    href(`/modes/${encodeURIComponent(code)}/xep-doi-hinh?${encodeLineup(units, emblems)}`)

  return (
    <section className="mode-page" aria-label="Đội hình">
      {likes.message && <p className="mode-message">{likes.message}</p>}
      <div className="lineup-section-head">
        <h2 className="mode-section-title">
          Đội hình đề xuất <small>xếp theo hạng rồi lượt thích</small>
        </h2>
        <LineupViewSwitch view={view} onChange={setView} />
      </div>
      {editorial.length ? (
        <div className="lineup-list">
          {editorial.map((lineup) => (
            <EditorialLineup
              key={lineup.id}
              lineup={lineup}
              index={index}
              likes={likes}
              base={guide.lineupLikes[lineup.id]?.likes ?? 0}
              recent={guide.lineupLikes[lineup.id]?.recentLikes ?? 0}
              view={view}
              onOpen={onOpen}
              builder={builderLink(lineup.units, lineup.emblems)}
            />
          ))}
        </div>
      ) : (
        <p className="mode-empty">Chưa có đội hình đề xuất.</p>
      )}

      <h2 className="mode-section-title">
        Đội hình cộng đồng <small>{communityTotal} đội hình</small>
      </h2>
      <div className="mode-toolbar">
        {(
          [
            ["popular", "Nhiều lượt thích"],
            ["trending", "Đang lên (7 ngày)"],
            ["recent", "Mới cập nhật"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="mode-chip"
            aria-pressed={sort === key}
            onClick={() => setSort(key)}
          >
            {label}
          </button>
        ))}
        <select
          className="mode-search"
          aria-label="Lọc theo quân cờ"
          value={unit ?? ""}
          onChange={(event) => setUnit(event.target.value || null)}
        >
          <option value="">Mọi quân cờ</option>
          {index.content.units.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      {community.isPending ? (
        <p className="mode-empty">Đang tải…</p>
      ) : community.isLoadingError ? (
        <p className="mode-empty">Chưa tải được đội hình cộng đồng.</p>
      ) : communityLineups.length === 0 ? (
        <p className="mode-empty">Chưa có đội hình cộng đồng phù hợp. Hãy là người đầu tiên chia sẻ đội hình!</p>
      ) : (
        <div className="lineup-list">
          {communityLineups.map((lineup) => (
            <article key={lineup.id} className="lineup-card">
              <header className="lineup-head">
                <h3>{lineup.name}</h3>
                {lineup.recentLikes > 0 && <span className="mode-badge">+{lineup.recentLikes} tuần này</span>}
                <span className="lineup-head-actions">
                  <LikeButton id={lineup.id} base={lineup.likes} likes={likes} own={own.has(lineup.id)} />
                  <LineupCopyMenu builder={builderLink(lineup.units, lineup.emblems)} />
                </span>
              </header>
              <div className="lineup-tags">
                <ActiveTraits units={lineup.units} emblems={lineup.emblems} index={index} />
              </div>
              <LineupFrame stages={[]} stage="LATE" onStage={() => undefined}>
                <LineupPieces units={lineup.units} view={view} index={index} onOpen={onOpen} />
              </LineupFrame>
              <LineupTips tip={lineup.note} />
            </article>
          ))}
          <InfiniteScroll query={community} label="đội hình cộng đồng" />
        </div>
      )}
      <ModeFab label="Đăng đội hình" to={href(`/modes/${encodeURIComponent(code)}/xep-doi-hinh`)} />
    </section>
  )
}

const STAGES = [
  { key: "EARLY", label: "Đầu trận" },
  { key: "MID", label: "Giữa trận" },
  { key: "LATE", label: "Cuối trận" },
] as const

/** Items the lineup builds first, numbered in order, each naming itself and its effect on hover. */
function PriorityItems({ codes, index }: { codes: string[]; index: GuideIndex }) {
  return (
    <section className="lineup-extra" aria-label="Trang bị ưu tiên">
      <h4>Trang bị ưu tiên</h4>
      <ol className="lineup-priority">
        {codes.map((code, at) => {
          const item = index.items.get(code)
          const src = index.image(item?.iconAssetId)
          return (
            <li key={code} title={item?.effect?.replace(/<[^>]+>/g, "") ?? undefined}>
              <b>{at + 1}</b>
              {src && <img src={src} alt="" />}
              <span>{item?.name ?? code}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** Blessings to take with the lineup, in order, drawn on their tier's color. */
function PriorityBlessings({ codes, index }: { codes: string[]; index: GuideIndex }) {
  const blessings = new Map(index.content.blessings.map((blessing) => [blessing.code, blessing]))
  return (
    <section className="lineup-extra" aria-label="Chúc phúc ưu tiên">
      <h4>Chúc phúc ưu tiên</h4>
      <ol className="lineup-priority">
        {codes.map((code, at) => {
          const blessing = blessings.get(code)
          if (!blessing) return null
          return (
            <li
              key={code}
              className="lineup-blessing"
              style={TIER_STYLE[blessing.tier]}
              title={blessing.description?.replace(/<[^>]+>/g, "") ?? undefined}
            >
              <b>{at + 1}</b>
              <BlessingIcon blessing={blessing} index={index} />
              <span>{blessing.name}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** Open a lineup in the builder, or copy it to paste there later with the builder's paste button. */
function LineupCopyMenu({ builder }: { builder: string }) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard?.writeText(new URL(builder, window.location.origin).toString())
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className="lineup-icon-button"
        aria-label={copied ? "Đã sao chép đội hình" : "Sao chép đội hình"}
        title={copied ? "Đã sao chép" : "Sao chép đội hình"}
        data-done={copied || undefined}
      >
        <WikiIcon name={copied ? "check" : "copy"} size={18} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} drawerTitle="Đội hình này" className="lineup-menu">
        <DropdownMenuItem className="lineup-menu-item" onSelect={() => navigate(builder)}>
          <WikiIcon name="board" size={20} />
          <span>
            <b>Mở trong Xếp đội hình</b>
            <small>Xếp tiếp ngay từ đội hình này</small>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem className="lineup-menu-item" onSelect={() => void copy()}>
          <WikiIcon name="copy" size={20} />
          <span>
            <b>Sao chép đội hình</b>
            <small>Dán vào Xếp đội hình bằng nút Dán, hoặc gửi cho bạn bè</small>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The board in a frame; the frame's top edge names the stage, or switches between stages when there are some. */
function LineupFrame({
  stages,
  stage,
  onStage,
  children,
}: {
  stages: NonNullable<Lineup["stages"]>
  stage: "EARLY" | "MID" | "LATE"
  onStage: (stage: "EARLY" | "MID" | "LATE") => void
  children: ReactNode
}) {
  return (
    <section className="lineup-frame" aria-label="Đội hình theo giai đoạn">
      <div className="lineup-frame-head">
        {stages.length > 0 ? (
          <div className="lineup-stages" role="group" aria-label="Giai đoạn trận">
            {STAGES.filter((entry) => entry.key === "LATE" || stages.some((item) => item.stage === entry.key)).map(
              (entry) => (
                <button
                  key={entry.key}
                  type="button"
                  aria-pressed={stage === entry.key}
                  onClick={() => onStage(entry.key)}
                >
                  {entry.label}
                </button>
              ),
            )}
          </div>
        ) : (
          <span className="lineup-frame-label">Đội hình</span>
        )}
      </div>
      {children}
    </section>
  )
}

/** Tips for playing the lineup. */
function LineupTips({ tip }: { tip?: string | null }) {
  if (!tip) return null
  return (
    <aside className="lineup-tips" aria-label="Mẹo">
      <WikiIcon name="bulb" size={20} />
      <div>
        <h4>Mẹo</h4>
        <p>{tip}</p>
      </div>
    </aside>
  )
}

function EditorialLineup({
  lineup,
  index,
  likes,
  base,
  recent,
  view,
  onOpen,
  builder,
}: {
  lineup: Lineup
  index: GuideIndex
  likes: Likes
  base: number
  recent: number
  view: LineupView
  onOpen: (code: string) => void
  builder: string
}) {
  const stages = lineup.stages ?? []
  const [stage, setStage] = useState<"EARLY" | "MID" | "LATE">("LATE")
  const current = stage === "LATE" ? null : stages.find((entry) => entry.stage === stage)
  const shown: LineupUnit[] = current
    ? current.unitCodes.map((unitCode) => {
        const full = lineup.units.find((unit) => unit.unitCode === unitCode)
        return { unitCode, carry: !!full?.carry, row: full?.row, column: full?.column, itemCodes: [] }
      })
    : lineup.units
  const side = (lineup.priorityItemCodes?.length ?? 0) > 0 || lineup.blessingCodes.length > 0
  return (
    <article className="lineup-card">
      <header className="lineup-head">
        {lineup.tier && (
          <span className="lineup-tier" data-tier={lineup.tier} title="Hạng biên tập">
            {lineup.tier}
          </span>
        )}
        <div className="lineup-title">
          <h3>{lineup.name}</h3>
          {lineup.summary && <p className="lineup-summary">{lineup.summary}</p>}
        </div>
        {lineup.difficulty && <span className="mode-badge">Độ khó: {DIFFICULTY_LABEL[lineup.difficulty]}</span>}
        {recent > 0 && <span className="mode-badge">+{recent} tuần này</span>}
        <span className="lineup-head-actions">
          <LikeButton id={lineup.id} base={base} likes={likes} />
          <LineupCopyMenu builder={builder} />
        </span>
      </header>
      <div className="lineup-tags">
        <ActiveTraits units={shown} emblems={lineup.emblems} index={index} />
        {lineup.emblems.length > 0 && (
          <div className="guide-trait-tags" aria-label="Huy hiệu">
            <span className="mode-meta">Huy hiệu</span>
            {lineup.emblems.map((emblem, at) => (
              <TraitTag key={`${emblem}-${at}`} code={emblem} index={index} />
            ))}
          </div>
        )}
      </div>
      <div className="lineup-body" data-side={side || undefined}>
        <LineupFrame stages={stages} stage={stage} onStage={setStage}>
          <LineupPieces units={shown} view={view} index={index} onOpen={onOpen} />
          {current?.note && <p className="lineup-stage-note">{current.note}</p>}
        </LineupFrame>
        {side && (
          <div className="lineup-side">
            {(lineup.priorityItemCodes?.length ?? 0) > 0 && (
              <PriorityItems codes={lineup.priorityItemCodes!} index={index} />
            )}
            {lineup.blessingCodes.length > 0 && <PriorityBlessings codes={lineup.blessingCodes} index={index} />}
          </div>
        )}
      </div>
      <LineupTips tip={lineup.notes} />
    </article>
  )
}

export function BuilderTab({
  code,
  index,
  onOpen,
}: {
  code: string
  index: GuideIndex
  onOpen: (code: string) => void
}) {
  const [params, setParams] = useSearchParams()
  const { units, emblems } = useMemo(() => decodeLineup(params.toString(), index.content), [params, index])
  const [cost, setCost] = useState<number | null>(null)
  const [traitPicks, setTraitPicks] = useState<string[]>([])
  const [picking, setPicking] = useState(false)
  const [view, setView] = useLineupView()
  const [selected, setSelected] = useState<string | null>(null)
  const [target, setTarget] = useState<{ row: BoardRow; column: number } | null>(null)
  const [emblemPicking, setEmblemPicking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [posting, setPosting] = useState(false)
  const [pasting, setPasting] = useState<{ open: boolean; text: string; message: string }>({
    open: false,
    text: "",
    message: "",
  })
  const applyPasted = (text: string) => {
    const trimmed = text.trim()
    let query = trimmed.replace(/^\?/, "")
    try {
      query = new URL(trimmed).search
    } catch {
      // Not an address: the text is the lineup's query itself.
    }
    const next = decodeLineup(query, index.content)
    if (!next.units.length) {
      setPasting({ open: true, text: trimmed, message: "Không đọc được đội hình từ nội dung này." })
      return
    }
    write(next.units, next.emblems)
    setPasting({ open: false, text: "", message: `Đã dán ${next.units.length} quân.` })
  }
  async function paste() {
    try {
      applyPasted(await navigator.clipboard.readText())
    } catch {
      setPasting({ open: true, text: "", message: "" })
    }
  }
  const layout = usePageLayout()
  const chosen = new Set(units.map((unit) => unit.unitCode))
  const counts = traitCounts(
    index.content,
    units.map((unit) => unit.unitCode),
    emblems,
  )
  const suggestions = suggestUnits(index.content, [...chosen], emblems).slice(0, 6)
  const picksOf = (kind: "FACTION" | "CLASS") =>
    traitPicks.filter((traitCode) => index.traits.get(traitCode)?.kind === kind)
  const fitsKind = (unit: (typeof index.content.units)[number], codes: string[]) =>
    !codes.length || codes.some((traitCode) => unit.traitCodes.includes(traitCode))
  const base = index.content.units.filter((unit) => !cost || unit.cost === cost)
  const pool = base.filter((unit) => fitsKind(unit, picksOf("FACTION")) && fitsKind(unit, picksOf("CLASS")))

  function write(next: BuilderUnit[], nextEmblems = emblems) {
    setParams(
      (current) => {
        const result = new URLSearchParams(encodeLineup(next, nextEmblems))
        const unit = current.get("unit")
        if (unit) result.set("unit", unit)
        return result
      },
      { replace: true, preventScrollReset: true },
    )
  }
  const { placed, bench } = placeUnits(units)
  /** Adds a unit, onto the cell an empty-cell tap chose; removes it when already chosen. */
  const toggleUnit = (code: string) => {
    if (chosen.has(code)) {
      if (selected === code) setSelected(null)
      write(units.filter((unit) => unit.unitCode !== code))
      return
    }
    if (units.length >= MAX_LINEUP_UNITS) return
    const cell = target && !placed.has(`${target.row}-${target.column}`) ? target : null
    write([...units, cell ? { unitCode: code, carry: false, ...cell } : { unitCode: code, carry: false }])
    if (cell) {
      setTarget(null)
      setPicking(false)
    }
  }
  /** A unit moved onto a cell, or off the board with no cell; whoever stood there takes the mover's old place. */
  const moveTo = (code: string, cell: { row: BoardRow; column: number } | null) => {
    const mover = units.find((unit) => unit.unitCode === code)
    if (!mover) return
    const occupant = cell ? placed.get(`${cell.row}-${cell.column}`) : undefined
    const at = (unit: BuilderUnit, next: { row?: BoardRow | null; column?: number | null } | null): BuilderUnit =>
      next?.row && next.column
        ? { unitCode: unit.unitCode, carry: unit.carry, row: next.row, column: next.column }
        : { unitCode: unit.unitCode, carry: unit.carry }
    write(
      units.map((unit) =>
        unit === mover ? at(unit, cell) : unit === occupant && occupant !== mover ? at(unit, mover) : unit,
      ),
    )
    setSelected(null)
  }
  const selectedUnit = selected ? units.find((unit) => unit.unitCode === selected) : undefined
  const selectedInfo = selectedUnit ? index.units.get(selectedUnit.unitCode) : undefined

  async function copyLink() {
    await navigator.clipboard?.writeText(window.location.href)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  /** Filters and every unit, in the drawer that an empty slot or the board's + opens on every screen. */
  const unitPicker = (
    <>
      <div className="builder-pool-head">
        <TraitFilter
          index={index}
          picked={traitPicks}
          onChange={setTraitPicks}
          countWith={(traitCode) => {
            const kind = index.traits.get(traitCode)?.kind
            const other = picksOf(kind === "FACTION" ? "CLASS" : "FACTION")
            return base.filter((unit) => unit.traitCodes.includes(traitCode) && fitsKind(unit, other)).length
          }}
        />
        <CostChips
          costs={[...new Set(index.content.units.map((unit) => unit.cost))].sort((a, b) => a - b)}
          value={cost}
          onChange={setCost}
        />
      </div>
      <div className="builder-pool">
        {pool.map((unit) => (
          <button
            key={unit.code}
            type="button"
            aria-pressed={chosen.has(unit.code)}
            style={costStyle(unit.cost)}
            title={unit.traitCodes.map((code) => index.traits.get(code)?.name).join(" · ")}
            onClick={() => toggleUnit(unit.code)}
            disabled={!chosen.has(unit.code) && units.length >= MAX_LINEUP_UNITS}
          >
            <UnitPortrait unit={unit} index={index} size="sm" />
            <span>{unit.name}</span>
          </button>
        ))}
      </div>
    </>
  )

  const slotAt = (slot: number) => {
    const item = units[slot]
    const unit = item ? index.units.get(item.unitCode) : undefined
    if (!item || !unit)
      return (
        <button
          key={slot}
          type="button"
          className="builder-slot builder-slot-empty"
          data-extra={slot >= BOARD_SLOTS || undefined}
          aria-label={slot >= BOARD_SLOTS ? "Thêm quân vào ô thêm" : "Thêm quân cờ"}
          onClick={() => setPicking(true)}
        >
          <span className="builder-slot-plus" aria-hidden="true">
            +
          </span>
          <span>{slot >= BOARD_SLOTS ? "Ô thêm" : "Thêm quân"}</span>
        </button>
      )
    return (
      <div
        key={item.unitCode}
        className="builder-slot"
        data-extra={slot >= BOARD_SLOTS || undefined}
        style={costStyle(unit.cost)}
      >
        <button
          type="button"
          style={{ border: 0, padding: 0 }}
          title={`Xem ${unit.name}`}
          onClick={() => onOpen(unit.code)}
        >
          <UnitPortrait unit={unit} index={index} size="sm" />
        </button>
        <strong>{unit.name}</strong>
        <span className="builder-slot-actions">
          <button
            type="button"
            aria-pressed={item.carry}
            aria-label={`${unit.name} là chủ lực`}
            title="Chủ lực (M)"
            className="carry-toggle"
            onClick={() => write(units.map((other) => (other === item ? { ...other, carry: !other.carry } : other)))}
          >
            M
          </button>
          <button
            type="button"
            onClick={() => toggleUnit(unit.code)}
            aria-label={`Bỏ ${unit.name}`}
            title="Bỏ khỏi đội hình"
          >
            ✕
          </button>
        </span>
      </div>
    )
  }

  return (
    <section className="mode-page" aria-label="Xếp đội hình">
      <div className="builder">
        <div className="mode-page">
          <section className="builder-board-card" aria-label="Đội hình đang xếp">
            <header className="builder-board-head">
              <span className="builder-board-title">
                Đội hình{" "}
                <b>
                  {Math.min(units.length, BOARD_SLOTS)}/{BOARD_SLOTS}
                </b>
                {units.length > BOARD_SLOTS ? " + ô thêm" : ""}
              </span>
              <span className="builder-board-actions">
                <LineupViewSwitch view={view} onChange={setView} />
                <button
                  type="button"
                  className="lineup-icon-button"
                  aria-label="Thêm quân cờ"
                  title="Thêm quân cờ"
                  disabled={units.length >= MAX_LINEUP_UNITS}
                  onClick={() => setPicking(true)}
                >
                  <WikiIcon name="plus" size={18} />
                </button>
                <button
                  type="button"
                  className="lineup-icon-button"
                  aria-label={copied ? "Đã chép đường dẫn" : "Chép đường dẫn chia sẻ"}
                  title={copied ? "Đã chép đường dẫn" : "Chép đường dẫn chia sẻ"}
                  data-done={copied || undefined}
                  disabled={!units.length}
                  onClick={() => void copyLink()}
                >
                  <WikiIcon name={copied ? "check" : "share"} size={18} />
                </button>
                <button
                  type="button"
                  className="lineup-icon-button"
                  aria-label="Dán đội hình đã sao chép"
                  title="Dán đội hình đã sao chép"
                  onClick={() => void paste()}
                >
                  <WikiIcon name="clipboard" size={18} />
                </button>
                <button
                  type="button"
                  className="lineup-icon-button"
                  data-tone="danger"
                  aria-label="Xóa hết"
                  title="Xóa hết"
                  disabled={!units.length}
                  onClick={() => {
                    setSelected(null)
                    write([], [])
                  }}
                >
                  <WikiIcon name="broom" size={18} />
                </button>
              </span>
            </header>
            {view === "board" ? (
              <BoardGrid
                label="Bàn cờ đang xếp"
                cell={(row, column) => {
                  const item = placed.get(`${row}-${column}`)
                  if (item)
                    return (
                      <BoardPiece
                        item={item}
                        index={index}
                        selected={selected === item.unitCode}
                        onClick={() =>
                          selected && selected !== item.unitCode
                            ? moveTo(selected, { row, column })
                            : setSelected(selected === item.unitCode ? null : item.unitCode)
                        }
                      />
                    )
                  return (
                    <button
                      type="button"
                      className="board-empty"
                      data-target={selected ? true : undefined}
                      aria-label={
                        selected
                          ? `Đặt vào ${ROW_LABEL[row]}, ô ${column}`
                          : `Thêm quân vào ${ROW_LABEL[row]}, ô ${column}`
                      }
                      disabled={!selected && units.length >= MAX_LINEUP_UNITS}
                      onClick={() => {
                        if (selected) return moveTo(selected, { row, column })
                        setTarget({ row, column })
                        setPicking(true)
                      }}
                    >
                      <span aria-hidden="true">+</span>
                    </button>
                  )
                }}
                footer={
                  <>
                    {bench.length > 0 && (
                      <div className="board-bench" aria-label="Chưa xếp chỗ">
                        <span className="mode-meta">Chưa xếp chỗ</span>
                        {bench.map((item) => (
                          <BoardPiece
                            key={item.unitCode}
                            item={item}
                            index={index}
                            selected={selected === item.unitCode}
                            onClick={() => setSelected(selected === item.unitCode ? null : item.unitCode)}
                          />
                        ))}
                      </div>
                    )}
                    {selectedUnit && selectedInfo && (
                      <div className="board-selected" aria-label={`Đang chọn ${selectedInfo.name}`}>
                        <strong>{selectedInfo.name}</strong>
                        <span className="builder-slot-actions">
                          <button
                            type="button"
                            aria-pressed={selectedUnit.carry}
                            className="carry-toggle"
                            title="Chủ lực (M)"
                            aria-label={`${selectedInfo.name} là chủ lực`}
                            onClick={() =>
                              write(
                                units.map((unit) => (unit === selectedUnit ? { ...unit, carry: !unit.carry } : unit)),
                              )
                            }
                          >
                            M
                          </button>
                          <button
                            type="button"
                            title={`Xem ${selectedInfo.name}`}
                            aria-label={`Xem ${selectedInfo.name}`}
                            onClick={() => onOpen(selectedInfo.code)}
                          >
                            <WikiIcon name="info" size={16} />
                          </button>
                          {cellOf(selectedUnit) && (
                            <button
                              type="button"
                              title="Đưa xuống hàng chờ"
                              aria-label="Đưa xuống hàng chờ"
                              onClick={() => moveTo(selectedUnit.unitCode, null)}
                            >
                              <WikiIcon name="chevron" size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Bỏ khỏi đội hình"
                            aria-label={`Bỏ ${selectedInfo.name}`}
                            onClick={() => toggleUnit(selectedUnit.unitCode)}
                          >
                            ✕
                          </button>
                        </span>
                      </div>
                    )}
                  </>
                }
              />
            ) : (
              <>
                <div className="builder-board">{Array.from({ length: BOARD_SLOTS }, (_, slot) => slotAt(slot))}</div>
                {/* An item opens one more slot; it stays apart so the board reads as the game's ten. */}
                <div className="builder-extra">
                  {slotAt(BOARD_SLOTS)}
                  <p className="mode-meta">
                    <b>Ô thêm</b> · cho quân thứ {BOARD_SLOTS + 1} khi có trang bị mở thêm ô.
                  </p>
                </div>
              </>
            )}
            {/* Emblems come from blessings such as the heart ones: each adds one to a faction or class without a unit. */}
            <div className="builder-emblems">
              <div className="builder-emblems-head">
                <span className="builder-board-title">
                  Huy hiệu{" "}
                  <b>
                    {emblems.length}/{MAX_EMBLEMS}
                  </b>
                </span>
                <span className="mode-meta">+1 vào một Phe/Nghề, như khi có chúc phúc “Trái tim…”</span>
                <button
                  type="button"
                  className="lineup-icon-button"
                  aria-label="Thêm huy hiệu"
                  title="Thêm huy hiệu"
                  disabled={emblems.length >= MAX_EMBLEMS}
                  onClick={() => setEmblemPicking(true)}
                >
                  <WikiIcon name="plus" size={18} />
                </button>
              </div>
              {emblems.length > 0 && (
                <div className="guide-trait-tags">
                  {emblems.map((emblem, at) => {
                    const trait = index.traits.get(emblem)
                    return (
                      <button
                        key={`${emblem}-${at}`}
                        type="button"
                        className="guide-trait-tag"
                        title="Bỏ huy hiệu"
                        onClick={() =>
                          write(
                            units,
                            emblems.filter((_, other) => other !== at),
                          )
                        }
                      >
                        <TraitIcon trait={trait} index={index} size={18} />
                        <b>+1</b>
                        {trait?.name ?? emblem}
                        <span aria-hidden="true">✕</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
          {pasting.open && (
            <form
              className="builder-paste"
              onSubmit={(event) => {
                event.preventDefault()
                applyPasted(pasting.text)
              }}
            >
              <input
                className="mode-search"
                autoFocus
                value={pasting.text}
                placeholder="Dán đường dẫn hoặc mã đội hình…"
                aria-label="Đội hình đã sao chép"
                onChange={(event) => setPasting({ ...pasting, text: event.target.value })}
              />
              <button type="submit" className="mode-chip" disabled={!pasting.text.trim()}>
                Dùng
              </button>
              <button
                type="button"
                className="mode-chip"
                onClick={() => setPasting({ open: false, text: "", message: "" })}
              >
                Hủy
              </button>
            </form>
          )}
          {pasting.message && <p className="mode-meta">{pasting.message}</p>}
          {layout === "compact" && (
            <ActiveTraits units={units.map((unit) => ({ ...unit, itemCodes: [] }))} emblems={emblems} index={index} />
          )}
        </div>
        <aside className="mode-page">
          <section className="mode-panel" aria-label="Phe và Nghề kích hoạt">
            <h2>Phe & Nghề</h2>
            {counts.length ? (
              <div className="builder-active">
                {counts.map((count) => (
                  <div key={count.trait.code} className="builder-trait" data-active={count.reachedTier >= 0}>
                    <TraitIcon trait={count.trait} index={index} size={28} />
                    <div>
                      <strong>
                        {count.count} {count.trait.name}
                      </strong>
                      <p>
                        {count.reachedTier >= 0
                          ? count.trait.tiers[count.reachedTier]?.effect
                          : `Cần thêm ${count.missing} để kích hoạt`}
                      </p>
                    </div>
                    <span className="builder-steps">
                      {count.trait.tiers.map((tier, at) => (
                        <i key={tier.count} data-on={at <= count.reachedTier}>
                          {tier.count}
                        </i>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mode-meta">Chưa chọn quân cờ nào.</p>
            )}
          </section>
          {suggestions.length > 0 && (
            <section className="mode-panel" aria-label="Gợi ý thêm">
              <h2>Gợi ý thêm</h2>
              <div className="builder-active">
                {suggestions.map(({ unit, gains, shared }) => (
                  <button
                    key={unit.code}
                    type="button"
                    className="guide-unit"
                    style={costStyle(unit.cost)}
                    onClick={() => toggleUnit(unit.code)}
                    disabled={units.length >= MAX_LINEUP_UNITS}
                  >
                    <UnitPortrait unit={unit} index={index} size="sm" />
                    <span>
                      <strong>{unit.name}</strong>
                      <span>
                        {gains.length
                          ? `Mở mốc: ${gains.map((code) => index.traits.get(code)?.name).join(", ")}`
                          : `Cùng ${shared.map((code) => index.traits.get(code)?.name).join(", ")}`}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
      <ModeFab label="Đăng đội hình" onClick={() => setPosting(true)} />
      <ModeDialog
        open={picking}
        onClose={() => {
          setPicking(false)
          setTarget(null)
        }}
        label="Chọn quân cờ"
        title={target ? `Chọn quân cho ${ROW_LABEL[target.row].toLowerCase()}, ô ${target.column}` : "Chọn quân cờ"}
      >
        <div className="unit-picker">{unitPicker}</div>
      </ModeDialog>
      <ModeDialog
        open={emblemPicking}
        onClose={() => setEmblemPicking(false)}
        label="Chọn huy hiệu"
        title={`Chọn huy hiệu · ${emblems.length}/${MAX_EMBLEMS}`}
      >
        <div className="trait-index">
          <p className="mode-meta">Mỗi huy hiệu cộng 1 vào Phe/Nghề đó; có thể chọn cùng một Phe/Nghề nhiều lần.</p>
          {(["FACTION", "CLASS"] as const).map((kind) => (
            <section key={kind} className="trait-index-group" aria-label={kind === "FACTION" ? "Phe" : "Nghề"}>
              <h2 className="mode-section-title">{kind === "FACTION" ? "Phe" : "Nghề"}</h2>
              <div className="trait-index-grid">
                {index.content.traits
                  .filter((trait) => trait.kind === kind)
                  .map((trait) => {
                    const taken = emblems.filter((code) => code === trait.code).length
                    return (
                      <button
                        key={trait.code}
                        type="button"
                        className="trait-index-item"
                        aria-pressed={taken > 0}
                        disabled={emblems.length >= MAX_EMBLEMS}
                        onClick={() => write(units, [...emblems, trait.code])}
                      >
                        <TraitIcon trait={trait} index={index} size={40} />
                        <span>{trait.name}</span>
                        {taken > 0 && <small>+{taken}</small>}
                      </button>
                    )
                  })}
              </div>
            </section>
          ))}
        </div>
      </ModeDialog>
      <ModeDialog open={posting} onClose={() => setPosting(false)} label="Đăng đội hình" title="Đăng đội hình">
        <SaveLineup code={code} units={units} emblems={emblems} index={index} />
      </ModeDialog>
    </section>
  )
}

function SaveLineup({
  code,
  units,
  emblems,
  index,
}: {
  code: string
  units: BuilderUnit[]
  emblems: string[]
  index: GuideIndex
}) {
  const { href } = useWikiContext()
  const session = useWikiSession()
  const client = useQueryClient()
  const me = useQuery({ ...myStateQuery(code, session.revision), enabled: session.status === "authenticated" })
  const [name, setName] = useState("")
  const [note, setNote] = useState("")
  const [message, setMessage] = useState("")
  const refresh = () => client.invalidateQueries({ queryKey: ["wiki", "game-mode", code] })
  const save = useMutation({
    mutationFn: () =>
      saveLineup(code, {
        name: name.trim(),
        note: note.trim() || undefined,
        units: units.map((unit) => ({ ...unit, itemCodes: [] })),
        emblems,
      }),
    onSuccess: () => {
      setMessage("Đã lưu và chia sẻ đội hình.")
      setName("")
      setNote("")
      void refresh()
    },
    onError: (error) => setMessage(lineupErrorMessage(error)),
  })
  const remove = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => deleteLineup(code, id, version),
    onSuccess: () => void refresh(),
    onError: (error) => setMessage(lineupErrorMessage(error)),
  })

  if (session.status !== "authenticated")
    return (
      <section className="mode-panel lineup-post">
        <p className="mode-meta">Đăng nhập để lưu đội hình, chia sẻ với cộng đồng và nhận lượt thích.</p>
        <button type="button" className="mode-chip" onClick={() => void signIn()}>
          Đăng nhập
        </button>
      </section>
    )

  return (
    <section className="mode-panel lineup-post">
      <form
        className="builder-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim() && units.length) save.mutate()
        }}
      >
        <input
          value={name}
          maxLength={60}
          placeholder="Tên đội hình"
          aria-label="Tên đội hình"
          onChange={(event) => setName(event.target.value)}
        />
        <textarea
          value={note}
          maxLength={280}
          rows={3}
          placeholder="Ghi chú lối chơi (tùy chọn)"
          aria-label="Ghi chú"
          onChange={(event) => setNote(event.target.value)}
        />
        <button type="submit" className="mode-chip" disabled={!name.trim() || !units.length || save.isPending}>
          {save.isPending ? "Đang lưu…" : "Lưu và chia sẻ"}
        </button>
        {message && <p className="mode-message">{message}</p>}
      </form>
      {me.data && me.data.lineups.length > 0 && (
        <>
          <h3>Đội hình của tôi</h3>
          <ul className="builder-active">
            {me.data.lineups.map((lineup) => (
              <li key={lineup.id} className="lineup-actions">
                <Link
                  to={href(
                    `/modes/${encodeURIComponent(code)}/xep-doi-hinh?${encodeLineup(lineup.units, lineup.emblems)}`,
                  )}
                >
                  {lineup.name}
                </Link>
                <span className="mode-meta">
                  ♥ {lineup.likes}
                  {lineup.status === "HIDDEN" && " · đã bị ẩn"}
                </span>
                <button
                  type="button"
                  className="mode-chip"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ id: lineup.id, version: lineup.version })}
                >
                  Xóa
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mode-meta">
        Quân trong đội: {units.map((unit) => index.units.get(unit.unitCode)?.name).join(", ") || "chưa có"}
      </p>
    </section>
  )
}

function Bars({ rows, unit }: { rows: { key: string; label: ReactNode; value: number }[]; unit?: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  return (
    <div className="insight-bars">
      {rows.map((row) => (
        <div key={row.key} className="insight-bar">
          <span>{row.label}</span>
          <div aria-hidden="true">
            <i style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
          <b>
            {row.value.toLocaleString("vi-VN")}
            {unit}
          </b>
        </div>
      ))}
    </div>
  )
}

export function InsightsTab({
  code,
  index,
  onOpen,
}: {
  code: string
  index: GuideIndex
  onOpen: (code: string) => void
}) {
  const insights = useQuery(insightsQuery(code))
  const { units, traits } = index.content
  const byCost = new Map<number, number>()
  units.forEach((unit) => byCost.set(unit.cost, (byCost.get(unit.cost) ?? 0) + 1))
  const leaders = (key: "health" | "physicalAttack") =>
    [...units]
      .filter((unit) => unit.stats?.[key]?.length === 3)
      .sort((a, b) => (b.stats![key][2] ?? 0) - (a.stats![key][2] ?? 0))
      .slice(0, 5)
  const unitButton = (unitCode: string) => {
    const unit = index.units.get(unitCode)
    return unit ? (
      <button type="button" className="guide-name-button" onClick={() => onOpen(unit.code)}>
        <UnitPortrait unit={unit} index={index} size="sm" />
        {unit.name}
      </button>
    ) : (
      unitCode
    )
  }

  return (
    <section className="mode-page" aria-label="Phân tích">
      <div className="mode-columns">
        <section className="mode-panel">
          <h2>Quân cờ được dùng nhiều</h2>
          {insights.isPending ? (
            <p className="mode-meta">Đang tải…</p>
          ) : insights.isError ? (
            <p className="mode-meta">Chưa tải được thống kê.</p>
          ) : (
            <>
              <p className="mode-meta">
                Từ {insights.data.lineupCount - insights.data.communityLineupCount} đội hình đề xuất và{" "}
                {insights.data.communityLineupCount} đội hình cộng đồng. Điểm = số lần xuất hiện × (1 + lượt thích). Đây
                là xu hướng xếp đội hình, không phải tỷ lệ thắng.
              </p>
              <Bars
                rows={insights.data.units.slice(0, 12).map((row) => ({
                  key: row.code,
                  label: unitButton(row.code),
                  value: row.weighted,
                }))}
              />
            </>
          )}
        </section>
        <section className="mode-panel">
          <h2>Phe & Nghề hay kích hoạt</h2>
          {insights.data && (
            <Bars
              rows={insights.data.traits.slice(0, 10).map((row) => ({
                key: row.code,
                label: <TraitTag code={row.code} index={index} />,
                value: row.activations,
              }))}
            />
          )}
        </section>
      </div>
      <div className="mode-columns">
        <section className="mode-panel">
          <h2>Phe & Nghề theo số quân cờ</h2>
          <Bars
            rows={[...traits]
              .map((trait) => ({
                key: trait.code,
                label: <TraitTag code={trait.code} index={index} />,
                value: index.membersOf(trait.code).length,
              }))
              .sort((a, b) => b.value - a.value)}
          />
        </section>
        <section className="mode-panel">
          <h2>Số quân cờ theo giá</h2>
          <Bars
            rows={[...byCost.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([cost, count]) => ({ key: String(cost), label: `${cost} vàng`, value: count }))}
          />
          <h2>Máu cao nhất (3★)</h2>
          <Bars
            rows={leaders("health").map((unit) => ({
              key: unit.code,
              label: unitButton(unit.code),
              value: unit.stats!.health[2]!,
            }))}
          />
          <h2>Công vật lý cao nhất (3★)</h2>
          <Bars
            rows={leaders("physicalAttack").map((unit) => ({
              key: unit.code,
              label: unitButton(unit.code),
              value: unit.stats!.physicalAttack[2]!,
            }))}
          />
        </section>
      </div>
    </section>
  )
}
