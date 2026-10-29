import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "react-router"
import type { GameSide, PublishedGame } from "@aov/community-contracts"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { StreamImage } from "../../components/stream-image"
import { gameQuery } from "./tournament-api"
import { ReferenceArt } from "./reference-art"
import { clock, LANES, LANE_SHORT, observationTimes, orderedParticipants, referenceName } from "./tournament-model"
import { EquipmentEvents, GameLoadouts, type LoadoutTab } from "./game-loadouts"

function TeamDraft({ side, game }: { side: GameSide; game: PublishedGame }) {
  const team = game.teams[side.teamId]
  return (
    <section className="team-draft" data-side={side.side}>
      <header>
        <StreamImage src={team?.logoUrl} name={team?.shortName || team?.name || "Đội"} />
        <span>
          <h2>{team?.name}</h2>
          <small>{side.side === "BLUE" ? "Phe xanh" : "Phe đỏ"}</small>
        </span>
        {game.content.winner === side.side && (
          <span className="draft-winner">
            <StreamIcon name="trophy" size={15} />
            Chiến thắng
          </span>
        )}
      </header>
      <div className="team-draft-bans">
        <StreamIcon name="ban" size={15} />
        <span className="sr-only">Cấm</span>
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
            <span className="draft-lane" title={LANES[participant.lane]}>
              {LANE_SHORT[participant.lane]}
            </span>
            <ReferenceArt catalog={game.catalog} kind="spells" selection={participant.spell} className="draft-spell" />
            <div>
              <strong>{game.players[participant.playerId || ""]?.nickname}</strong>
              <span>{referenceName(game.catalog, "heroes", participant.hero)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function PublishedGameView({ game }: { game: PublishedGame }) {
  const [tab, setTab] = useState<LoadoutTab>("equipment")
  const times = observationTimes(game.content.sides)
  const last = times.at(-1) ?? 0
  const [selectedTime, setSelectedTime] = useState<number | null>(null)
  const time = selectedTime ?? last
  const scope = game.resolvedContext
  return (
    <StreamShell>
      <title>{`${game.teams[game.content.sides[0]?.teamId || ""]?.shortName || "Trận đấu"} vs ${game.teams[game.content.sides[1]?.teamId || ""]?.shortName || ""} — Ván ${game.content.number} | AOV Stream`}</title>
      <div className="game-detail">
        <nav className="game-breadcrumb" aria-label="Đường dẫn">
          <Link to="/">
            <StreamIcon name="back" size={15} />
            Giải đấu
          </Link>
          <span>/</span>
          <Link to={`/?tournament=${game.series.tournamentId}`}>{game.tournament.name}</Link>
        </nav>
        <header className="game-heading">
          <div>
            <span className="stream-eyebrow">
              {game.series.stage || "TRẬN ĐẤU"} · BO{game.series.bestOf}
            </span>
            <h1>
              {game.series.name || game.tournament.name}
              <span>Ván {game.content.number}</span>
            </h1>
            <div className="game-context">
              <span>
                <StreamIcon name="clock" size={13} />
                {game.content.durationSeconds ? clock(game.content.durationSeconds) : "Chưa rõ thời lượng"}
              </span>
              <span>{game.content.region}</span>
              <span title={scope?.patchTitle || undefined}>
                {scope?.unknown
                  ? "Chưa rõ patch"
                  : `${scope?.seasonName || ""} · ${scope?.patchCode || "Patch đã lưu"}`}
              </span>
              {scope?.includeUnscoped && (
                <span title="Một số mục được đối chiếu từ dữ liệu nền chưa xác định ngày áp dụng.">
                  Có dữ liệu nền chưa rõ mốc
                </span>
              )}
            </div>
          </div>
          {game.content.sourceUrl && (
            <a className="game-source" href={game.content.sourceUrl} target="_blank" rel="noreferrer noopener">
              <StreamIcon name="play" size={15} />
              Xem nguồn
              <StreamIcon name="external" size={12} />
            </a>
          )}
        </header>
        <div className="game-draft-board">
          {game.content.sides.map((side) => (
            <TeamDraft side={side} game={game} key={side.side} />
          ))}
        </div>
        <section className="game-observation-section">
          <div className="game-section-bar">
            <h2>Góc nhìn chiến thuật</h2>
            <div className="game-loadout-tabs" role="group" aria-label="Thông tin tuyển thủ">
              {(
                [
                  { key: "equipment", label: "Trang bị", icon: "sword" },
                  { key: "arcana", label: "Bảng ngọc", icon: "spark" },
                  { key: "enchantments", label: "Phù hiệu", icon: "shield" },
                ] as const
              ).map((item) => (
                <button type="button" key={item.key} aria-pressed={tab === item.key} onClick={() => setTab(item.key)}>
                  <StreamIcon name={item.icon} size={16} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
          {tab === "equipment" && times.length > 0 && (
            <div className="equipment-timeline">
              <div>
                <StreamIcon name="clock" size={16} />
                <label htmlFor="game-time">
                  Mốc đang xem <strong>{clock(time)}</strong>
                </label>
                <span>{times.length} mốc ghi nhận</span>
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
            Tên và ảnh được giữ theo bản dữ liệu đã xuất bản cho ván này. Ô “?” là chưa quan sát; ô trống là đã xác nhận
            không có đồ.{game.content.note && <span>{game.content.note}</span>}
          </p>
        </div>
      </div>
    </StreamShell>
  )
}

export function GamePage() {
  const { id = "" } = useParams()
  const query = useQuery(gameQuery(id))
  if (query.data) return <PublishedGameView game={query.data} key={query.data.publishedAt} />
  return (
    <StreamShell>
      <div className="stream-state" role="status">
        <StreamIcon name={query.isPending ? "clock" : "info"} size={32} />
        <h1>{query.isPending ? "Đang mở ván đấu…" : "Chưa mở được ván đấu"}</h1>
        {query.isError && (
          <>
            <p>{query.error.message}</p>
            <button type="button" onClick={() => void query.refetch()}>
              Thử lại
            </button>
            <Link to="/">Về danh sách</Link>
          </>
        )}
      </div>
    </StreamShell>
  )
}
