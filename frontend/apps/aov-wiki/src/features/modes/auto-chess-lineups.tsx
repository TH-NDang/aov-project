import { useMemo, useState, type ReactNode } from "react"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useWikiContext } from "../../context/wiki-context"
import { signIn, useWikiSession } from "../auth/wiki-auth"
import {
  costSummary,
  decodeLineup,
  DIFFICULTY_LABEL,
  encodeLineup,
  foldText,
  MAX_EMBLEMS,
  MAX_LINEUP_UNITS,
  ROW_LABEL,
  suggestUnits,
  traitCounts,
  type Lineup,
  type LineupUnit,
} from "./auto-chess-model"
import { costStyle, TraitIcon, TraitTag, UnitPortrait, type GuideIndex } from "./auto-chess-guide"
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
  return (
    <div className="lineup-units">
      {units.map((item) => {
        const unit = index.units.get(item.unitCode)
        if (!unit) return null
        return (
          <button
            key={item.unitCode}
            type="button"
            className="lineup-unit"
            data-carry={item.carry}
            style={costStyle(unit.cost)}
            title={`${unit.name}${item.row ? ` · ${ROW_LABEL[item.row]}` : ""}${item.carry ? " · chủ lực" : ""}`}
            onClick={() => onOpen(unit.code)}
          >
            {item.carry && <em title="Chủ lực">★</em>}
            <UnitPortrait unit={unit} index={index} size="md" />
            <span>{unit.name}</span>
            {item.itemCodes.length > 0 && (
              <span className="lineup-items">
                {item.itemCodes.map((code) => {
                  const src = index.image(index.items.get(code)?.iconAssetId)
                  return src ? <img key={code} src={src} alt={index.items.get(code)?.name ?? ""} /> : null
                })}
              </span>
            )}
          </button>
        )
      })}
    </div>
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
      <h2 className="mode-section-title">
        Đội hình đề xuất <small>xếp theo hạng rồi lượt thích</small>
      </h2>
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
        <Link className="mode-chip" to={href(`/modes/${encodeURIComponent(code)}/xep-doi-hinh`)}>
          + Tạo đội hình
        </Link>
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
                <LikeButton id={lineup.id} base={lineup.likes} likes={likes} own={own.has(lineup.id)} />
              </header>
              {lineup.note && <p className="mode-prose">{lineup.note}</p>}
              <LineupUnits units={lineup.units} index={index} onOpen={onOpen} />
              <ActiveTraits units={lineup.units} emblems={lineup.emblems} index={index} />
              <div className="lineup-actions">
                <Link className="mode-chip" to={builderLink(lineup.units, lineup.emblems)}>
                  Mở trong công cụ xếp đội hình
                </Link>
              </div>
            </article>
          ))}
          <InfiniteScroll query={community} label="đội hình cộng đồng" />
        </div>
      )}
    </section>
  )
}

function EditorialLineup({
  lineup,
  index,
  likes,
  base,
  recent,
  onOpen,
  builder,
}: {
  lineup: Lineup
  index: GuideIndex
  likes: Likes
  base: number
  recent: number
  onOpen: (code: string) => void
  builder: string
}) {
  const cost = costSummary(
    index.content,
    lineup.units.map((unit) => unit.unitCode),
  )
  return (
    <article className="lineup-card">
      <header className="lineup-head">
        <span className="lineup-tier" data-tier={lineup.tier ?? undefined} title="Hạng biên tập">
          {lineup.tier ?? "–"}
        </span>
        <h3>{lineup.name}</h3>
        {lineup.difficulty && <span className="mode-badge">Độ khó: {DIFFICULTY_LABEL[lineup.difficulty]}</span>}
        {recent > 0 && <span className="mode-badge">+{recent} tuần này</span>}
        <LikeButton id={lineup.id} base={base} likes={likes} />
      </header>
      {lineup.summary && <p className="mode-prose">{lineup.summary}</p>}
      <LineupUnits units={lineup.units} index={index} onOpen={onOpen} />
      <ActiveTraits units={lineup.units} emblems={lineup.emblems} index={index} />
      <p className="mode-meta">
        Tổng giá {cost.total} vàng · {lineup.units.length} quân
        {lineup.emblems.length > 0 &&
          ` · huy hiệu: ${lineup.emblems.map((code) => index.traits.get(code)?.name).join(", ")}`}
      </p>
      {lineup.notes && <p className="guide-note">{lineup.notes}</p>}
      <div className="lineup-actions">
        <Link className="mode-chip" to={builder}>
          Mở trong công cụ xếp đội hình
        </Link>
      </div>
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
  const [search, setSearch] = useState("")
  const [cost, setCost] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const layout = usePageLayout()
  const chosen = new Set(units.map((unit) => unit.unitCode))
  const counts = traitCounts(
    index.content,
    units.map((unit) => unit.unitCode),
    emblems,
  )
  const summary = costSummary(index.content, [...chosen])
  const suggestions = suggestUnits(index.content, [...chosen], emblems).slice(0, 6)
  const needle = foldText(search.trim())
  const pool = index.content.units.filter(
    (unit) =>
      (!cost || unit.cost === cost) &&
      (!needle ||
        foldText([unit.name, ...unit.traitCodes.map((code) => index.traits.get(code)?.name ?? "")].join(" ")).includes(
          needle,
        )),
  )

  function write(next: { unitCode: string; carry: boolean }[], nextEmblems = emblems) {
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
  const toggleUnit = (code: string) =>
    chosen.has(code)
      ? write(units.filter((unit) => unit.unitCode !== code))
      : units.length < MAX_LINEUP_UNITS && write([...units, { unitCode: code, carry: false }])

  async function copyLink() {
    await navigator.clipboard?.writeText(window.location.href)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="mode-page" aria-label="Xếp đội hình">
      <p className="mode-lead">
        Chọn tối đa {MAX_LINEUP_UNITS} quân cờ để xem Phe/Nghề được kích hoạt. Mỗi quân cờ khác nhau được tính một lần;
        huy hiệu (từ chúc phúc như “Trái tim…”) cộng thêm một. Đường dẫn trang luôn chứa đội hình để chia sẻ.
      </p>
      <div className="builder">
        <div className="mode-page">
          <div className="builder-board" aria-label="Đội hình đang xếp">
            {Array.from({ length: MAX_LINEUP_UNITS }, (_, slot) => {
              const item = units[slot]
              const unit = item ? index.units.get(item.unitCode) : undefined
              if (!item || !unit)
                return (
                  <div key={slot} className="builder-slot">
                    Trống
                  </div>
                )
              return (
                <div key={item.unitCode} className="builder-slot" style={costStyle(unit.cost)}>
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
                      title="Chủ lực"
                      onClick={() =>
                        write(units.map((other) => (other === item ? { ...other, carry: !other.carry } : other)))
                      }
                    >
                      ★
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
            })}
          </div>
          <div className="mode-toolbar">
            <span className="mode-meta">
              {units.length}/{MAX_LINEUP_UNITS} quân · tổng giá {summary.total} vàng
              {summary.byCost.length > 0 && ` (${summary.byCost.map(([value, n]) => `${n}×${value}`).join(", ")})`}
            </span>
            <button type="button" className="mode-chip" onClick={() => void copyLink()} disabled={!units.length}>
              {copied ? "Đã chép đường dẫn" : "Chép đường dẫn chia sẻ"}
            </button>
            <button type="button" className="mode-chip" onClick={() => write([], [])} disabled={!units.length}>
              Xóa hết
            </button>
          </div>
          {layout === "compact" && (
            <ActiveTraits units={units.map((unit) => ({ ...unit, itemCodes: [] }))} emblems={emblems} index={index} />
          )}
          <div className="mode-toolbar" role="group" aria-label="Huy hiệu Phe/Nghề">
            <select
              className="mode-search"
              aria-label="Thêm huy hiệu"
              value=""
              disabled={emblems.length >= MAX_EMBLEMS}
              onChange={(event) => event.target.value && write(units, [...emblems, event.target.value])}
            >
              <option value="">
                + Huy hiệu ({emblems.length}/{MAX_EMBLEMS})
              </option>
              {index.content.traits.map((trait) => (
                <option key={trait.code} value={trait.code}>
                  {trait.name}
                </option>
              ))}
            </select>
            {emblems.map((emblem, at) => (
              <button
                key={`${emblem}-${at}`}
                type="button"
                className="mode-chip"
                onClick={() =>
                  write(
                    units,
                    emblems.filter((_, other) => other !== at),
                  )
                }
                title="Bỏ huy hiệu"
              >
                +1 {index.traits.get(emblem)?.name} ✕
              </button>
            ))}
          </div>
          <div className="mode-toolbar">
            <input
              className="mode-search"
              type="search"
              placeholder="Tìm quân cờ hoặc Phe/Nghề…"
              aria-label="Tìm quân cờ để thêm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {[...new Set(index.content.units.map((unit) => unit.cost))]
              .sort((a, b) => a - b)
              .map((value) => (
                <button
                  key={value}
                  type="button"
                  className="mode-chip"
                  style={costStyle(value)}
                  aria-pressed={cost === value}
                  onClick={() => setCost(cost === value ? null : value)}
                >
                  <span className="guide-cost">{value}</span>
                </button>
              ))}
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
          <SaveLineup code={code} units={units} emblems={emblems} index={index} />
        </aside>
      </div>
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
  units: { unitCode: string; carry: boolean }[]
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
      <section className="mode-panel">
        <h2>Chia sẻ đội hình</h2>
        <p className="mode-meta">Đăng nhập để lưu đội hình, chia sẻ với cộng đồng và nhận lượt thích.</p>
        <button type="button" className="mode-chip" onClick={() => void signIn()}>
          Đăng nhập
        </button>
      </section>
    )

  return (
    <section className="mode-panel">
      <h2>Chia sẻ đội hình</h2>
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
      <button type="button" className="guide-trait-tag" onClick={() => onOpen(unit.code)}>
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
                label: index.traits.get(row.code)?.name ?? row.code,
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
