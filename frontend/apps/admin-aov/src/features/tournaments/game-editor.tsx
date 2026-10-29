import { useEffect, useMemo, useState } from "react"
import { useBlocker } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  Catalog,
  DocumentView,
  GameContent,
  Participant,
  PlayerContent,
  Selection,
  TeamContent,
} from "@aov/community-contracts"
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  Save,
  Settings2,
  ShieldBan,
} from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@aov/ui/components/alert-dialog"
import { CatalogPicker } from "./catalog-picker"
import { GameScope } from "./game-scope"
import { ParticipantEditor } from "./participant-editor"
import { LANES, missingFieldLabel } from "./tournament-model"
import { tournamentApi, tournamentError, tournamentIssueFields, tournamentKeys } from "./tournament-api"
import { RecordLifecycleActions } from "./record-lifecycle-actions"
import { allowedOptions, draftUnavailable, seriesLocks } from "../esports/model/series-rules"

const EMPTY_CATALOG: Catalog = { heroes: [], items: [], arcana: [], enchantments: [], spells: [] }

export function GameEditor({
  entry,
  teams,
  players,
  canWrite,
  canPublish,
  onBack,
  actorKey,
  tournamentRegion,
  seriesGames = [],
  bestOf = 1,
}: {
  entry: DocumentView<GameContent>
  teams: DocumentView<TeamContent>[]
  players: DocumentView<PlayerContent>[]
  canWrite: boolean
  canPublish: boolean
  onBack: () => void
  actorKey: string
  tournamentRegion?: string
  /** Other games of the series, for the rule that a team cannot pick again a hero it already played. */
  seriesGames?: DocumentView<GameContent>[]
  bestOf?: number
}) {
  const [saved, setSaved] = useState(entry)
  const [content, setContent] = useState(entry.content)
  const [error, setError] = useState("")
  const [status, setStatus] = useState("")
  const [lifecycleBusy, setLifecycleBusy] = useState(false)
  const [serverFields, setServerFields] = useState<string[]>([])
  const missingFields = [...new Set([...saved.missingFields, ...serverFields])]
  const [participant, setParticipant] = useState<{ side: number; index: number } | null>(null)
  const [sourceTime, setSourceTime] = useState(String(entry.content.sourceTimestampSeconds ?? 0))
  const dirty = JSON.stringify(content) !== JSON.stringify(saved.content)
  const blocker = useBlocker(dirty)
  const client = useQueryClient()
  const catalogQuery = useQuery({
    queryKey: [
      ...tournamentKeys.all,
      "catalog",
      actorKey,
      content.region,
      content.locale,
      content.seasonId ?? "",
      content.patchVariantId ?? "",
      !!content.includeUnscoped,
    ],
    queryFn: ({ signal }) => tournamentApi.catalog(content, signal),
    staleTime: 60000,
    retry: 1,
  })
  const catalog = catalogQuery.data ?? EMPTY_CATALOG
  const locks = useMemo(
    () =>
      seriesLocks(
        seriesGames.filter((game) => game.id !== entry.id),
        content.number,
        bestOf,
      ),
    [seriesGames, entry.id, content.number, bestOf],
  )
  const teamName = (teamId: string) => teams.find((team) => team.id === teamId)?.content.name ?? "Đội"
  // Recorded ban/pick turns own the bans and the drafted heroes; they are edited in the match's draft panel.
  const drafted = !!content.draft?.turns.length
  const mutation = useMutation({
    mutationFn: async (action: "publish" | "save" | "withdraw") =>
      action === "publish"
        ? tournamentApi.publish(saved)
        : action === "withdraw"
          ? tournamentApi.withdraw(saved)
          : tournamentApi.save("games", saved, content),
  })
  const disabled = !canWrite || mutation.isPending || lifecycleBusy
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  function updateSide(index: number, change: (side: GameContent["sides"][number]) => GameContent["sides"][number]) {
    setStatus("")
    setContent((current) => ({
      ...current,
      sides: current.sides.map((side, position) => (position === index ? change(side) : side)),
    }))
  }
  function updateParticipant(side: number, index: number, value: Participant) {
    updateSide(side, (current) => ({
      ...current,
      participants: current.participants.map((participant, position) => (position === index ? value : participant)),
    }))
  }
  async function submit(action: "publish" | "save" | "withdraw") {
    setError("")
    setStatus("")
    try {
      const result = await mutation.mutateAsync(action)
      setSaved(result)
      setContent(result.content)
      setServerFields([])
      setStatus(
        action === "publish"
          ? "Đã xuất bản ván. Dữ liệu, tên và ảnh đã được chốt cho bản công khai."
          : action === "withdraw"
            ? "Đã gỡ bản công khai. Bản nháp và lịch sử xuất bản vẫn được giữ."
            : "Đã lưu bản nháp trên máy chủ.",
      )
      await client.invalidateQueries({ queryKey: tournamentKeys.all })
    } catch (error) {
      setError(tournamentError(error))
      setServerFields(tournamentIssueFields(error))
    }
  }
  function back() {
    onBack()
  }
  const currentParticipant = participant ? content.sides[participant.side]?.participants[participant.index] : undefined
  const currentPlayer = players.find((player) => player.id === currentParticipant?.playerId)

  return (
    <div className="tournament-game-editor">
      <AlertDialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.state === "blocked") blocker.reset()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ván còn thay đổi chưa lưu</AlertDialogTitle>
            <AlertDialogDescription>
              Lưu nháp ván để giữ thay đổi trên máy chủ. Rời trang bây giờ sẽ bỏ phần chưa lưu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.state === "blocked" && blocker.reset()}>
              Ở lại biên tập
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.state === "blocked" && blocker.proceed()}>
              Bỏ thay đổi và rời trang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <header className="tournament-game-toolbar">
        <Button type="button" variant="ghost" size="sm" onClick={back} disabled={lifecycleBusy}>
          <ArrowLeft size={15} />
          Trận đấu
        </Button>
        <div>
          <h1>Ván {content.number}</h1>
          <span className="tournament-state" data-published={!!saved.publishedAt}>
            {saved.publishedAt ? "Có bản công khai" : "Bản nháp"}
            {dirty ? " · Chưa lưu" : ""}
          </span>
        </div>
        <div className="tournament-game-actions">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !dirty}
            onClick={() => void submit("save")}
          >
            {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Lưu nháp ván
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canPublish || mutation.isPending || lifecycleBusy || dirty || !!missingFields.length}
            title={dirty ? "Lưu bản nháp trước khi xuất bản" : undefined}
            onClick={() => void submit("publish")}
          >
            <CheckCircle2 size={14} />
            Xuất bản
          </Button>
          {saved.publishedAt && canPublish && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" size="sm" variant="ghost" disabled={mutation.isPending || lifecycleBusy || dirty}>
                  Gỡ công khai
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Gỡ ván khỏi trang công khai?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Bản nháp và lịch sử vẫn được giữ để sửa rồi xuất bản lại. Người xem Stream sẽ không thấy ván này cho
                    tới lần xuất bản tiếp theo.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Giữ công khai</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void submit("withdraw")}>Gỡ công khai</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {canWrite && (
            <RecordLifecycleActions
              kind="games"
              entry={saved}
              name={`ván ${content.number}`}
              compact
              disabled={dirty || mutation.isPending}
              onChanged={onBack}
              onBusyChange={setLifecycleBusy}
            />
          )}
        </div>
      </header>
      {saved.publishedAt && (
        <p className="tournament-muted">
          Đang sửa bản nháp. Bản đã xuất bản vẫn được giữ nguyên cho tới lần xuất bản tiếp theo.
        </p>
      )}
      {error && (
        <p className="tournament-error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="tournament-success" role="status">
          {status}
        </p>
      )}
      {!!missingFields.length && (
        <details className="tournament-readiness" open={!dirty}>
          <summary>
            <ClipboardCheck size={15} />
            {missingFields.length} phần cần bổ sung để xuất bản{dirty ? " · danh sách theo lần lưu gần nhất" : ""}
          </summary>
          <ul>
            {missingFields.map((field, index) => (
              <li key={`${field}-${index}`}>{missingFieldLabel(field)}</li>
            ))}
          </ul>
        </details>
      )}
      <fieldset disabled={mutation.isPending || lifecycleBusy} className="tournament-game-fields">
        <GameScope content={content} disabled={disabled} onChange={setContent} tournamentRegion={tournamentRegion} />
        <details className="tournament-game-metadata">
          <summary>Thông tin ván và nguồn kiểm chứng</summary>
          <fieldset className="tournament-game-metadata-grid" disabled={disabled}>
            <label>
              Số ván
              <input
                type="number"
                min={1}
                max={99}
                value={content.number}
                onChange={(event) => setContent({ ...content, number: Number(event.target.value) })}
              />
            </label>
            <label>
              Đội thắng
              <select
                value={content.winner ?? ""}
                onChange={(event) =>
                  setContent({ ...content, winner: (event.target.value || null) as GameContent["winner"] })
                }
              >
                <option value="">Chưa rõ / chưa kết thúc</option>
                <option value="BLUE">Đội xanh</option>
                <option value="RED">Đội đỏ</option>
              </select>
            </label>
            <label>
              Thời lượng (giây)
              <input
                type="number"
                min={0}
                value={content.durationSeconds ?? ""}
                onChange={(event) =>
                  setContent({ ...content, durationSeconds: event.target.value ? Number(event.target.value) : null })
                }
              />
            </label>
            <label>
              Nguồn video
              <input
                type="url"
                value={content.sourceUrl ?? ""}
                onChange={(event) => setContent({ ...content, sourceUrl: event.target.value })}
                maxLength={2048}
              />
            </label>
            <label>
              Mốc video (giây)
              <input
                type="number"
                min={0}
                value={sourceTime}
                onChange={(event) => {
                  setSourceTime(event.target.value)
                  setContent({ ...content, sourceTimestampSeconds: Number(event.target.value) })
                }}
              />
            </label>
            <label>
              Ghi chú
              <textarea
                value={content.note ?? ""}
                onChange={(event) => setContent({ ...content, note: event.target.value })}
                maxLength={4000}
              />
            </label>
          </fieldset>
          {content.sourceUrl && /^https?:\/\//i.test(content.sourceUrl) && (
            <a href={content.sourceUrl} rel="noopener noreferrer" target="_blank">
              Mở nguồn <ExternalLink size={12} />
            </a>
          )}
        </details>
        {catalogQuery.isError && (
          <p className="tournament-catalog-notice">
            Danh mục Wiki chưa sẵn sàng tại mốc này. Có thể nhập tên thủ công trong ô chọn; các lựa chọn đã nhập vẫn
            được giữ.
            <button type="button" onClick={() => void catalogQuery.refetch()}>
              Thử lại
            </button>
          </p>
        )}
        {catalog.resolvedContext && (
          <p className="tournament-scope-note">
            Danh mục đối chiếu:{" "}
            {catalog.resolvedContext.unknown
              ? "Chưa xác định mốc lịch sử"
              : `${catalog.resolvedContext.seasonName ?? ""} · ${catalog.resolvedContext.patchCode ?? ""}`}
            {catalog.resolvedContext.includeUnscoped ? " · Có dữ liệu nền chưa rõ mốc" : ""}
          </p>
        )}
        <div className="tournament-game-sides">
          {content.sides.map((side, sideIndex) => {
            const team = teams.find((team) => team.id === side.teamId)
            const setBan = (index: number, value: Selection) =>
              updateSide(sideIndex, (side) => ({
                ...side,
                bans: side.bans.map((ban, position) => (position === index ? value : ban)),
              }))
            return (
              <section className="tournament-side-editor" data-side={side.side} key={side.side}>
                <header>
                  <span className="tournament-side-dot" />
                  <h2>{team?.content.name ?? (side.side === "BLUE" ? "Đội xanh" : "Đội đỏ")}</h2>
                  <select
                    disabled={disabled}
                    aria-label={`Đội ${side.side === "BLUE" ? "xanh" : "đỏ"}`}
                    value={side.teamId}
                    onChange={(event) => updateSide(sideIndex, (side) => ({ ...side, teamId: event.target.value }))}
                  >
                    <option value="">Chọn đội</option>
                    {teams.map((team) => (
                      <option value={team.id} key={team.id}>
                        {team.content.name}
                      </option>
                    ))}
                  </select>
                </header>
                <div className="tournament-ban-heading">
                  <ShieldBan size={14} />
                  <span>Cấm · 4 tướng</span>
                  {drafted && <span className="tournament-muted">· theo lượt cấm chọn ở trang trận</span>}
                </div>
                <div className="tournament-ban-grid">
                  {side.bans.map((ban, index) => (
                    <CatalogPicker
                      key={index}
                      label={`Cấm ${index + 1}`}
                      value={ban}
                      options={allowedOptions(
                        catalog.heroes,
                        draftUnavailable(content, { side: side.side, kind: "ban", index }, locks, teamName),
                        ban,
                      )}
                      disabled={disabled || drafted}
                      onChange={(value) => setBan(index, value)}
                    />
                  ))}
                </div>
                <div className="tournament-roster">
                  {side.participants.map((player, index) => (
                    <div className="tournament-roster-row" key={`${side.side}-${index}`}>
                      <span className="tournament-lane" title={LANES.find((lane) => lane.code === player.lane)?.name}>
                        {LANES.find((lane) => lane.code === player.lane)?.short ?? player.lane}
                      </span>
                      <select
                        disabled={disabled}
                        aria-label={`Tuyển thủ ${side.side} ${LANES[index]?.name}`}
                        value={player.playerId ?? ""}
                        onChange={(event) =>
                          updateParticipant(sideIndex, index, { ...player, playerId: event.target.value || null })
                        }
                      >
                        <option value="">Chọn tuyển thủ</option>
                        {players.map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.content.nickname}
                          </option>
                        ))}
                      </select>
                      <CatalogPicker
                        value={player.hero}
                        options={allowedOptions(
                          catalog.heroes,
                          draftUnavailable(content, { side: side.side, kind: "pick", index }, locks, teamName),
                          player.hero,
                        )}
                        label={`Tướng ${LANES[index]?.short}`}
                        disabled={disabled || drafted}
                        onChange={(hero) => updateParticipant(sideIndex, index, { ...player, hero })}
                      />
                      <CatalogPicker
                        value={player.spell}
                        options={catalog.spells}
                        label={`Phụ trợ ${LANES[index]?.short}`}
                        disabled={disabled}
                        onChange={(spell) => updateParticipant(sideIndex, index, { ...player, spell })}
                      />
                      <button
                        className="tournament-icon-button"
                        type="button"
                        title="Ngọc, phù hiệu và trang bị"
                        aria-label={`Thông tin bổ sung ${players.find((item) => item.id === player.playerId)?.content.nickname ?? LANES[index]?.name}`}
                        onClick={() => setParticipant({ side: sideIndex, index })}
                      >
                        <Settings2 size={15} />
                        <span>
                          {player.equipmentSnapshots.length ? `${player.equipmentSnapshots.length} mốc` : "Chi tiết"}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </fieldset>
      {currentParticipant && participant && (
        <ParticipantEditor
          key={`${participant.side}-${participant.index}`}
          participant={currentParticipant}
          name={currentPlayer?.content.nickname ?? LANES[participant.index]?.name ?? "Tuyển thủ"}
          catalog={catalog}
          disabled={disabled}
          open={!!participant}
          onClose={() => setParticipant(null)}
          onChange={(value) => updateParticipant(participant.side, participant.index, value)}
        />
      )}
    </div>
  )
}
