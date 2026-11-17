import { useState } from "react"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate, useSearchParams } from "react-router"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/public-overlay"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { signIn, useWikiSession } from "../../lib/wiki-auth"
import {
  BOARD_SLOTS,
  cellOf,
  DIFFICULTY_NAMES,
  encodeLineup,
  ROW_NAMES,
  type LabelNames,
  type Lineup,
  type LineupUnit,
} from "./auto-chess-model"
import { ActiveTraits, LineupBoard, LineupViewSwitch, useLineupView, type LineupView } from "./lineup-board"
import { BlessingIcon, costStyle, TIER_STYLE, TraitTag, UnitPortrait, type GuideIndex } from "./guide-ui"
import { ModeFab, ModeHeading } from "./mode-ui"
import {
  communityLineupsQuery,
  lineupErrorMessage,
  modeKeys,
  myStateQuery,
  setLike,
  type LineupSort,
  type PublicGuide,
} from "./mode-api"

const TIER_ORDER: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 }

const SORTS: [LineupSort, LabelNames][] = [
  ["popular", ["Nhiều lượt thích", "Most liked"]],
  ["trending", ["Đang lên (7 ngày)", "Trending (7 days)"]],
  ["recent", ["Mới cập nhật", "Recently updated"]],
]
/** How a sort reads in the address; the default sort has none. */
const SORT_KEYS: Partial<Record<LineupSort, string>> = { trending: "dang-len", recent: "moi" }

/** Likes of the signed-in reader, with the server's answer applied right away. */
function useLikes(code: string) {
  const { locale } = useWikiContext()
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
      void client.invalidateQueries({ queryKey: modeKeys.insights(code) })
    },
    onError: (error) => setMessage(lineupErrorMessage(error, locale)),
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
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const count = likes.likes(id, base)
  const counted = text(`${count} lượt thích`, `${count} ${count === 1 ? "like" : "likes"}`)
  if (likes.session.status !== "authenticated")
    return (
      <button
        type="button"
        className="mode-chip like-button"
        aria-label={`${counted}. ${text("Đăng nhập để thích", "Sign in to like")}`}
        title={text("Đăng nhập để thích", "Sign in to like")}
        onClick={() => void signIn()}
      >
        <span aria-hidden="true">♡</span>
        {count}
      </button>
    )
  const liked = likes.liked(id)
  const action = own
    ? text("Đội hình của bạn", "Your lineup")
    : liked
      ? text("Bỏ thích", "Unlike")
      : text("Thích đội hình này", "Like this lineup")
  return (
    <button
      type="button"
      className="mode-chip like-button"
      aria-pressed={liked}
      aria-label={`${counted}. ${action}`}
      disabled={own || likes.pending === id}
      title={action}
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
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const shown = units.filter((item) => index.units.has(item.unitCode))
  return (
    <div
      className="lineup-units"
      aria-label={text(
        `${Math.min(shown.length, BOARD_SLOTS)}/${BOARD_SLOTS} ô`,
        `${Math.min(shown.length, BOARD_SLOTS)}/${BOARD_SLOTS} slots`,
      )}
    >
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
            title={`${unit.name}${item.row ? ` · ${text(...ROW_NAMES[item.row])}` : ""}${item.carry ? text(" · chủ lực", " · carry") : ""}${extra ? text(" · ô thêm từ trang bị", " · extra slot from an item") : ""}`}
            onClick={() => onOpen(unit.code)}
          >
            <span className="lineup-portrait">
              <UnitPortrait unit={unit} index={index} size="md" />
              {item.carry && (
                <em className="carry-mark" title={text("Chủ lực", "Carry")} aria-label={text("Chủ lực", "Carry")}>
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
  const { href, locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const compact = usePageLayout() === "compact"
  const likes = useLikes(code)
  const [view, setView] = useLineupView()
  // The community list's sort and unit live in the address, so a reload or a shared link keeps them.
  const [params, setParams] = useSearchParams()
  const sort = SORTS.find(([key]) => SORT_KEYS[key] === params.get("xep"))?.[0] ?? "popular"
  const asked = params.get("quan")
  const unit = asked && index.units.has(asked) ? asked : null
  const change = (key: "xep" | "quan", value: string | null | undefined) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  const setSort = (value: LineupSort) => change("xep", SORT_KEYS[value])
  const setUnit = (value: string | null) => change("quan", value)
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
          title={text("Đội hình đề xuất", "Recommended lineups")}
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
          title={text("Đội hình cộng đồng", "Community lineups")}
          count={communityTotal}
          note="Đội hình người đọc đã lưu và chia sẻ."
          action={
            compact ? undefined : (
              <Link className="mode-chip" data-tone="accent" to={postHref}>
                <WikiIcon name="plus" size={16} />
                {text("Đăng đội hình", "Post a lineup")}
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
                {text(...label)}
              </button>
            ))}
          </div>
          <label className="guide-select">
            <span className="sr-only">{text("Lọc theo quân cờ", "Filter by unit")}</span>
            <select value={unit ?? ""} onChange={(event) => setUnit(event.target.value || null)}>
              <option value="">{text("Mọi quân cờ", "All units")}</option>
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
            <p>{text("Chưa tải được đội hình cộng đồng.", "Community lineups could not be loaded.")}</p>
            <button type="button" className="mode-chip" onClick={() => void community.refetch()}>
              {text("Thử lại", "Retry")}
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
                        <p className="lineup-recent">
                          {text(
                            `+${lineup.recentLikes} lượt thích tuần này`,
                            `+${lineup.recentLikes} ${lineup.recentLikes === 1 ? "like" : "likes"} this week`,
                          )}
                        </p>
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
            <InfiniteScroll
              query={community}
              label={text("đội hình cộng đồng", "Community lineups")}
              retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
            />
          </>
        )}
      </section>
      {compact && <ModeFab label={text("Đăng đội hình", "Post a lineup")} to={postHref} />}
    </div>
  )
}

const STAGES = [
  { key: "EARLY", label: "Đầu trận", english: "Early game" },
  { key: "MID", label: "Giữa trận", english: "Mid game" },
  { key: "LATE", label: "Cuối trận", english: "Late game" },
] as const

type Stage = (typeof STAGES)[number]["key"]

/** Items the lineup builds first, numbered in order, each naming itself and its effect on hover. */
function PriorityItems({ codes, index }: { codes: string[]; index: GuideIndex }) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  return (
    <section className="lineup-extra" aria-label={text("Trang bị ưu tiên", "Priority items")}>
      <h4>{text("Trang bị ưu tiên", "Priority items")}</h4>
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
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const blessings = new Map(index.content.blessings.map((blessing) => [blessing.code, blessing]))
  return (
    <section className="lineup-extra" aria-label={text("Chúc phúc ưu tiên", "Priority blessings")}>
      <h4>{text("Chúc phúc ưu tiên", "Priority blessings")}</h4>
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
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
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
        aria-label={copied ? text("Đã sao chép đội hình", "Lineup copied") : text("Sao chép đội hình", "Copy lineup")}
        title={copied ? text("Đã sao chép", "Copied") : text("Sao chép đội hình", "Copy lineup")}
        data-done={copied || undefined}
      >
        <WikiIcon name={copied ? "check" : "copy"} size={18} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        drawerTitle={text("Đội hình này", "This lineup")}
        className="lineup-menu"
      >
        <DropdownMenuItem className="lineup-menu-item" onSelect={() => navigate(builder)}>
          <WikiIcon name="chessboard" size={20} />
          <span>
            <b>{text("Mở trong Xếp đội hình", "Open in Lineup builder")}</b>
            <small>{text("Xếp tiếp ngay từ đội hình này", "Keep building from this lineup")}</small>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem className="lineup-menu-item" onSelect={() => void copy()}>
          <WikiIcon name="copy" size={20} />
          <span>
            <b>{text("Sao chép đội hình", "Copy lineup")}</b>
            <small>
              {text(
                "Dán vào Xếp đội hình bằng nút Dán, hoặc gửi cho bạn bè",
                "Paste it into Lineup builder with the Paste button, or send it to friends",
              )}
            </small>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Tips for playing the lineup, after a rule at the card's foot. */
function LineupTips({ tip }: { tip?: string | null }) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  if (!tip) return null
  return (
    <aside className="lineup-tips" aria-label={text("Mẹo", "Tips")}>
      <WikiIcon name="bulb" size={18} />
      <p>
        <b>{text("Mẹo", "Tips")}</b> {tip}
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
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
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
          <span className="lineup-tier" data-tier={lineup.tier} title={text("Hạng biên tập", "Editorial tier")}>
            {lineup.tier}
          </span>
        )}
        <div className="lineup-title">
          <h3>{lineup.name}</h3>
          {lineup.summary && <p>{lineup.summary}</p>}
          {recent > 0 && (
            <p className="lineup-recent">
              {text(`+${recent} lượt thích tuần này`, `+${recent} ${recent === 1 ? "like" : "likes"} this week`)}
            </p>
          )}
        </div>
        <span className="lineup-head-actions">
          <LikeButton id={lineup.id} base={base} likes={likes} />
          <LineupCopyMenu builder={builder} />
        </span>
      </header>
      {(lineup.difficulty || lineup.emblems.length > 0) && (
        <p className="lineup-facts">
          {lineup.difficulty && (
            <span>
              {text("Độ khó", "Difficulty")}: {text(...DIFFICULTY_NAMES[lineup.difficulty])}
            </span>
          )}
          {lineup.emblems.length > 0 && (
            <span className="guide-trait-tags" aria-label={text("Huy hiệu", "Emblems")}>
              {text("Huy hiệu", "Emblems")}
              {lineup.emblems.map((emblem, at) => (
                <TraitTag key={`${emblem}-${at}`} code={emblem} index={index} />
              ))}
            </span>
          )}
        </p>
      )}
      <ActiveTraits units={shown} emblems={lineup.emblems} index={index} />
      {stages.length > 0 && (
        <div className="lineup-stages" role="group" aria-label={text("Giai đoạn trận", "Game stage")}>
          {STAGES.filter((entry) => entry.key === "LATE" || stages.some((item) => item.stage === entry.key)).map(
            (entry) => (
              <button
                key={entry.key}
                type="button"
                className="mode-chip"
                aria-pressed={stage === entry.key}
                onClick={() => setStage(entry.key)}
              >
                {text(entry.label, entry.english)}
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
