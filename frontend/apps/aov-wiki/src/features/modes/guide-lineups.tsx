import { useState } from "react"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "react-router"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/public-overlay"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext } from "../../context/wiki-context"
import { signIn, useWikiSession } from "../auth/wiki-auth"
import {
  BOARD_SLOTS,
  cellOf,
  DIFFICULTY_LABEL,
  encodeLineup,
  ROW_LABEL,
  type Lineup,
  type LineupUnit,
} from "./auto-chess-model"
import { ActiveTraits, LineupBoard, LineupViewSwitch, useLineupView, type LineupView } from "./lineup-board"
import { BlessingIcon, costStyle, TIER_STYLE, TraitTag, UnitPortrait, type GuideIndex } from "./guide-ui"
import { ModeFab, ModeHeading } from "./mode-ui"
import {
  communityLineupsQuery,
  lineupErrorMessage,
  myStateQuery,
  setLike,
  type LineupSort,
  type PublicGuide,
} from "./mode-api"

const TIER_ORDER: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 }

const SORTS: [LineupSort, string][] = [
  ["popular", "Nhiều lượt thích"],
  ["trending", "Đang lên (7 ngày)"],
  ["recent", "Mới cập nhật"],
]

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

/** The heart and the count; a signed-out reader is asked to sign in, a reader's own lineup cannot be liked. */
function LikeButton({ id, base, likes, own }: { id: string; base: number; likes: Likes; own?: boolean }) {
  const count = likes.likes(id, base)
  if (likes.session.status !== "authenticated")
    return (
      <button
        type="button"
        className="mode-chip like-button"
        aria-label={`${count} lượt thích. Đăng nhập để thích`}
        title="Đăng nhập để thích"
        onClick={() => void signIn()}
      >
        <span aria-hidden="true">♡</span>
        {count}
      </button>
    )
  const liked = likes.liked(id)
  return (
    <button
      type="button"
      className="mode-chip like-button"
      aria-pressed={liked}
      aria-label={`${count} lượt thích. ${own ? "Đội hình của bạn" : liked ? "Bỏ thích" : "Thích đội hình này"}`}
      disabled={own || likes.pending === id}
      title={own ? "Đội hình của bạn" : liked ? "Bỏ thích" : "Thích đội hình này"}
      onClick={() => likes.toggle(id, !liked)}
    >
      <span aria-hidden="true">{liked ? "♥" : "♡"}</span>
      {count}
    </button>
  )
}

/** The plain list of a lineup: every unit with its name, then the free slots of the board. */
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
            <span className="lineup-unit-name">{unit.name}</span>
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

/** Cards while the community lineups load, in the grid they will fill. */
function LineupSkeletons() {
  return (
    <div className="lineup-grid" role="status" aria-label="Đang tải đội hình cộng đồng">
      <span className="lineup-card lineup-skeleton" />
      <span className="lineup-card lineup-skeleton" />
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
  const compact = usePageLayout() === "compact"
  const likes = useLikes(code)
  const [view, setView] = useLineupView()
  const [sort, setSort] = useState<LineupSort>("popular")
  const [unit, setUnit] = useState<string | null>(null)
  const community = useInfiniteQuery(communityLineupsQuery(code, sort, unit))
  const communityLineups = community.data?.pages.flatMap((page) => page.items) ?? []
  const communityTotal = community.data?.pages[0]?.totalElements
  const own = new Set(likes.me.data?.lineups.map((lineup) => lineup.id))
  const editorial = [...guide.content.lineups].sort(
    (a, b) =>
      (TIER_ORDER[a.tier ?? ""] ?? 9) - (TIER_ORDER[b.tier ?? ""] ?? 9) ||
      (guide.lineupLikes[b.id]?.likes ?? 0) - (guide.lineupLikes[a.id]?.likes ?? 0),
  )
  const builderLink = (units: LineupUnit[], emblems: string[]) =>
    href(`/modes/${encodeURIComponent(code)}/xep-doi-hinh?${encodeLineup(units, emblems)}`)
  const postHref = href(`/modes/${encodeURIComponent(code)}/xep-doi-hinh`)

  return (
    <div className="guide-tab-body lineup-tab">
      {likes.message && (
        <p className="mode-message" role="alert">
          {likes.message}
        </p>
      )}
      <section className="mode-section" aria-labelledby="lineups-editorial">
        <ModeHeading
          id="lineups-editorial"
          title="Đội hình đề xuất"
          count={editorial.length}
          note="Xếp theo hạng biên tập, rồi theo lượt thích."
          action={<LineupViewSwitch view={view} onChange={setView} labels={!compact} />}
        />
        {editorial.length ? (
          <div className="lineup-grid">
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
          <p className="mode-meta">Biên tập viên chưa đề xuất đội hình nào.</p>
        )}
      </section>

      <section className="mode-section" aria-labelledby="lineups-community">
        <ModeHeading
          id="lineups-community"
          title="Đội hình cộng đồng"
          count={communityTotal}
          note="Đội hình người đọc đã lưu và chia sẻ."
          action={
            compact ? undefined : (
              <Link className="mode-chip" data-tone="accent" to={postHref}>
                <WikiIcon name="plus" size={16} />
                Đăng đội hình
              </Link>
            )
          }
        />
        <div className="guide-toolbar" data-stack={compact || undefined}>
          <div className="mode-chip-row" role="group" aria-label="Sắp xếp đội hình cộng đồng">
            {SORTS.map(([key, label]) => (
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
          </div>
          <label className="guide-select">
            <span className="sr-only">Lọc theo quân cờ</span>
            <select value={unit ?? ""} onChange={(event) => setUnit(event.target.value || null)}>
              <option value="">Mọi quân cờ</option>
              {index.content.units.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {community.isPending ? (
          <LineupSkeletons />
        ) : community.isLoadingError ? (
          <div className="guide-state" role="alert">
            <p>Chưa tải được đội hình cộng đồng.</p>
            <button type="button" className="mode-chip" onClick={() => void community.refetch()}>
              Thử lại
            </button>
          </div>
        ) : communityLineups.length === 0 ? (
          <div className="guide-state">
            <p>
              {unit
                ? "Chưa có đội hình cộng đồng nào có quân cờ này."
                : "Chưa có đội hình cộng đồng. Hãy là người đầu tiên chia sẻ đội hình!"}
            </p>
            <Link className="mode-chip" data-tone="accent" to={postHref}>
              Xếp và đăng đội hình
            </Link>
          </div>
        ) : (
          <>
            <div className="lineup-grid">
              {communityLineups.map((lineup) => (
                <article key={lineup.id} className="lineup-card">
                  <header className="lineup-head">
                    <div className="lineup-title">
                      <h3>{lineup.name}</h3>
                      {lineup.recentLikes > 0 && (
                        <p className="lineup-recent">+{lineup.recentLikes} lượt thích tuần này</p>
                      )}
                    </div>
                    <span className="lineup-head-actions">
                      <LikeButton id={lineup.id} base={lineup.likes} likes={likes} own={own.has(lineup.id)} />
                      <LineupCopyMenu builder={builderLink(lineup.units, lineup.emblems)} />
                    </span>
                  </header>
                  <ActiveTraits units={lineup.units} emblems={lineup.emblems} index={index} />
                  <LineupPieces units={lineup.units} view={view} index={index} onOpen={onOpen} />
                  <LineupTips tip={lineup.note} />
                </article>
              ))}
            </div>
            <InfiniteScroll query={community} label="đội hình cộng đồng" />
          </>
        )}
      </section>
      {compact && <ModeFab label="Đăng đội hình" to={postHref} />}
    </div>
  )
}

const STAGES = [
  { key: "EARLY", label: "Đầu trận" },
  { key: "MID", label: "Giữa trận" },
  { key: "LATE", label: "Cuối trận" },
] as const

type Stage = (typeof STAGES)[number]["key"]

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

/** Blessings to take with the lineup, in order, each with the game's card icon. */
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
          <WikiIcon name="chessboard" size={20} />
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

/** Tips for playing the lineup, after a rule at the card's foot. */
function LineupTips({ tip }: { tip?: string | null }) {
  if (!tip) return null
  return (
    <aside className="lineup-tips" aria-label="Mẹo">
      <WikiIcon name="bulb" size={18} />
      <p>
        <b>Mẹo</b> {tip}
      </p>
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
  const [stage, setStage] = useState<Stage>("LATE")
  const current = stage === "LATE" ? null : stages.find((entry) => entry.stage === stage)
  const shown: LineupUnit[] = current
    ? current.unitCodes.map((unitCode) => {
        const full = lineup.units.find((unit) => unit.unitCode === unitCode)
        return { unitCode, carry: !!full?.carry, row: full?.row, column: full?.column, itemCodes: [] }
      })
    : lineup.units
  const priorityItems = lineup.priorityItemCodes ?? []
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
          {lineup.summary && <p>{lineup.summary}</p>}
          {recent > 0 && <p className="lineup-recent">+{recent} lượt thích tuần này</p>}
        </div>
        <span className="lineup-head-actions">
          <LikeButton id={lineup.id} base={base} likes={likes} />
          <LineupCopyMenu builder={builder} />
        </span>
      </header>
      {(lineup.difficulty || lineup.emblems.length > 0) && (
        <p className="lineup-facts">
          {lineup.difficulty && <span>Độ khó: {DIFFICULTY_LABEL[lineup.difficulty]}</span>}
          {lineup.emblems.length > 0 && (
            <span className="guide-trait-tags" aria-label="Huy hiệu">
              Huy hiệu
              {lineup.emblems.map((emblem, at) => (
                <TraitTag key={`${emblem}-${at}`} code={emblem} index={index} />
              ))}
            </span>
          )}
        </p>
      )}
      <ActiveTraits units={shown} emblems={lineup.emblems} index={index} />
      {stages.length > 0 && (
        <div className="lineup-stages" role="group" aria-label="Giai đoạn trận">
          {STAGES.filter((entry) => entry.key === "LATE" || stages.some((item) => item.stage === entry.key)).map(
            (entry) => (
              <button
                key={entry.key}
                type="button"
                className="mode-chip"
                aria-pressed={stage === entry.key}
                onClick={() => setStage(entry.key)}
              >
                {entry.label}
              </button>
            ),
          )}
        </div>
      )}
      <LineupPieces units={shown} view={view} index={index} onOpen={onOpen} />
      {current?.note && <p className="lineup-stage-note">{current.note}</p>}
      {(priorityItems.length > 0 || lineup.blessingCodes.length > 0) && (
        <div className="lineup-side">
          {priorityItems.length > 0 && <PriorityItems codes={priorityItems} index={index} />}
          {lineup.blessingCodes.length > 0 && <PriorityBlessings codes={lineup.blessingCodes} index={index} />}
        </div>
      )}
      <LineupTips tip={lineup.notes} />
    </article>
  )
}
