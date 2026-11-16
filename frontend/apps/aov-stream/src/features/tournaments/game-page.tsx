import { useState, type CSSProperties } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "react-router"
import type { GameSide, PublishedGame } from "@aov/community-contracts"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { StreamImage } from "../../components/stream-image"
import { useStreamLocale } from "../../components/stream-locale"
import { gameQuery } from "./tournament-api"
import { hueOf } from "../community/community-ui"
import { ReferenceArt } from "./reference-art"
import {
  clock,
  LANE_NAMES,
  LANE_SHORT,
  observationTimes,
  orderedParticipants,
  referenceName,
  UNKNOWN_REFERENCE,
} from "./tournament-model"
import { EquipmentEvents, GameLoadouts, type LoadoutTab } from "./game-loadouts"
import { MatchGameNavigation } from "./match-components"

function TeamDraft({ side, game }: { side: GameSide; game: PublishedGame }) {
  const { text } = useStreamLocale()
  const team = game.teams[side.teamId]
  return (
    <section className="team-draft" data-side={side.side}>
      <header>
        <StreamImage src={team?.logoUrl} name={team?.shortName || team?.name || text("Đội", "Team")} />
        <span>
          <h2>{team?.name}</h2>
          <small>{side.side === "BLUE" ? text("Phe xanh", "Blue side") : text("Phe đỏ", "Red side")}</small>
        </span>
        {game.content.winner === side.side && (
          <span className="draft-winner">
            <StreamIcon name="trophy" size={15} />
            {text("Chiến thắng", "Victory")}
          </span>
        )}
      </header>
      <div className="team-draft-bans">
        <StreamIcon name="ban" size={15} />
        <span className="sr-only">{text("Cấm", "Bans")}</span>
        {side.bans.map((selection, index) => (
          <span key={index}>
            <ReferenceArt catalog={game.catalog} kind="heroes" selection={selection} />
            <i aria-hidden="true" />
          </span>
        ))}
      </div>
      <div className="team-draft-picks">
        {orderedParticipants(side.participants).map((participant) => (
          <article className="draft-pick" key={participant.lane}>
            <ReferenceArt catalog={game.catalog} kind="heroes" selection={participant.hero} />
            <span className="draft-lane" title={text(LANE_NAMES[participant.lane][0], LANE_NAMES[participant.lane][1])}>
              {LANE_SHORT[participant.lane]}
            </span>
            <ReferenceArt catalog={game.catalog} kind="spells" selection={participant.spell} className="draft-spell" />
            <div>
              <strong>{game.players[participant.playerId || ""]?.nickname}</strong>
              <span>{referenceName(game.catalog, "heroes", participant.hero, text(...UNKNOWN_REFERENCE))}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function PublishedGameView({ game }: { game: PublishedGame }) {
  const { text } = useStreamLocale()
  const [tab, setTab] = useState<LoadoutTab>("equipment")
  const times = observationTimes(game.content.sides)
  const last = times.at(-1) ?? 0
  const [selectedTime, setSelectedTime] = useState<number | null>(null)
  const time = selectedTime ?? last
  const scope = game.resolvedContext
  return (
    <StreamShell>
      <title>{`${game.teams[game.content.sides[0]?.teamId || ""]?.shortName || text("Trận đấu", "Match")} vs ${game.teams[game.content.sides[1]?.teamId || ""]?.shortName || ""} — ${text(`Ván ${game.content.number}`, `Game ${game.content.number}`)} | AOV Stream`}</title>
      <div className="game-detail">
        <nav className="game-breadcrumb" aria-label={text("Đường dẫn", "Breadcrumb")}>
          <Link to="/competitions">
            <StreamIcon name="back" size={16} />
            {text("Giải đấu", "Tournaments")}
          </Link>
          <span aria-hidden="true">/</span>
          <Link to={`/competitions/${game.series.tournamentId}?tab=matches`}>{game.tournament.name}</Link>
          <span aria-hidden="true">/</span>
          <Link to={`/matches/${game.content.seriesId}`}>{game.series.name || text("Trận đấu", "Match")}</Link>
          <span aria-hidden="true">/</span>
          <span>{text(`Ván ${game.content.number}`, `Game ${game.content.number}`)}</span>
        </nav>
        <header className="game-heading hub-art" style={{ "--hub-hue": hueOf(game.tournament.name) } as CSSProperties}>
          <div>
            <span className="hub-kicker">
              {game.series.stage || text("TRẬN ĐẤU", "MATCH")} · BO{game.series.bestOf}
            </span>
            <h1>
              {game.series.name || game.tournament.name}
              <span>{text(`Ván ${game.content.number}`, `Game ${game.content.number}`)}</span>
            </h1>
            <div className="game-context">
              <span>
                <StreamIcon name="clock" size={13} />
                {game.content.durationSeconds
                  ? clock(game.content.durationSeconds)
                  : text("Chưa rõ thời lượng", "Unknown duration")}
              </span>
              <span>{game.content.region}</span>
              <span title={scope?.patchTitle || undefined}>
                {scope?.unknown
                  ? text("Chưa rõ patch", "Unknown patch")
                  : `${scope?.seasonName || ""} · ${scope?.patchCode || text("Patch đã lưu", "Saved patch")}`}
              </span>
              {scope?.includeUnscoped && (
                <span
                  title={text(
                    "Một số mục được đối chiếu từ dữ liệu nền chưa xác định ngày áp dụng.",
                    "Some entries were matched against baseline data with no known effective date.",
                  )}
                >
                  {text("Có dữ liệu nền chưa rõ mốc", "Includes undated baseline data")}
                </span>
              )}
            </div>
          </div>
          {game.content.sourceUrl && (
            <a className="game-source" href={game.content.sourceUrl} target="_blank" rel="noreferrer noopener">
              <StreamIcon name="play" size={16} />
              {text("Xem nguồn", "View source")}
              <StreamIcon name="external" size={12} />
            </a>
          )}
        </header>
        <MatchGameNavigation seriesId={game.content.seriesId} activeGameId={game.id} />
        <div className="game-draft-board">
          {game.content.sides.map((side) => (
            <TeamDraft side={side} game={game} key={side.side} />
          ))}
        </div>
        <section className="game-observation-section">
          <div className="game-section-bar">
            <h2>{text("Góc nhìn chiến thuật", "Tactical view")}</h2>
            <div
              className="game-loadout-tabs"
              role="group"
              aria-label={text("Thông tin tuyển thủ", "Player information")}
            >
              {(
                [
                  { key: "equipment", label: "Trang bị", english: "Equipment", icon: "sword" },
                  { key: "arcana", label: "Bảng ngọc", english: "Arcana", icon: "spark" },
                  { key: "enchantments", label: "Phù hiệu", english: "Enchantments", icon: "shield" },
                ] as const
              ).map((item) => (
                <button type="button" key={item.key} aria-pressed={tab === item.key} onClick={() => setTab(item.key)}>
                  <StreamIcon name={item.icon} size={16} />
                  <span>{text(item.label, item.english)}</span>
                </button>
              ))}
            </div>
          </div>
          {tab === "equipment" && times.length > 0 && (
            <div className="equipment-timeline">
              <div>
                <StreamIcon name="clock" size={16} />
                <label htmlFor="game-time">
                  {text("Mốc đang xem", "Time shown")} <strong>{clock(time)}</strong>
                </label>
                <span>
                  {text(
                    `${times.length} mốc ghi nhận`,
                    `${times.length} recorded ${times.length === 1 ? "time" : "times"}`,
                  )}
                </span>
              </div>
              <input
                id="game-time"
                type="range"
                min="0"
                max={Math.max(last, 1)}
                step="1"
                value={time}
                onChange={(event) => setSelectedTime(Number(event.target.value))}
              />
              <div className="equipment-ticks">
                {times.map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={time === value}
                    onClick={() => setSelectedTime(value)}
                  >
                    {clock(value)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <GameLoadouts game={game} tab={tab} time={time} />
          {tab === "equipment" && <EquipmentEvents game={game} time={time} />}
        </section>
        <div className="game-provenance">
          <StreamIcon name="info" size={16} />
          <p>
            {text(
              "Tên và ảnh được giữ theo bản dữ liệu đã xuất bản cho ván này. Ô “?” là chưa quan sát; ô trống là đã xác nhận không có đồ.",
              "Names and images are kept as in the data version published for this game. A “?” slot was not observed; an empty slot is confirmed to hold no item.",
            )}
            {game.content.note && <span>{game.content.note}</span>}
          </p>
        </div>
      </div>
    </StreamShell>
  )
}

export function GamePage() {
  const { text } = useStreamLocale()
  const { id = "" } = useParams()
  const query = useQuery(gameQuery(id))
  if (query.data) return <PublishedGameView game={query.data} key={query.data.publishedAt} />
  return (
    <StreamShell>
      <div className="hub-state" role="status">
        <StreamIcon name={query.isPending ? "clock" : "info"} size={28} />
        <h1>
          {query.isPending
            ? text("Đang mở ván đấu…", "Opening the game…")
            : text("Chưa mở được ván đấu", "The game could not be opened")}
        </h1>
        {query.isError && (
          <>
            <p>{query.error.message}</p>
            <div className="hub-state-actions">
              <button type="button" className="cp-button cp-primary" onClick={() => void query.refetch()}>
                {text("Thử lại", "Retry")}
              </button>
              <Link className="cp-button" to="/games">
                {text("Về danh sách", "Back to the list")}
              </Link>
            </div>
          </>
        )}
      </div>
    </StreamShell>
  )
}
