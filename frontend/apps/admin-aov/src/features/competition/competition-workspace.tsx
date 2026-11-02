import { useEffect, useState } from "react"
import { Link, useParams, useSearchParams, useBlocker } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, ChevronRight, ExternalLink, Plus, Save, Trash2 } from "lucide-react"
import {
  aogStages,
  slotLabel,
  type CompetitionView,
  type CompetitionPlan,
  type CompetitionStage,
  type PlannedMatch,
  type CompetitionSlot,
} from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { Textarea } from "@aov/ui/components/textarea"
import { Field, Section } from "@/features/community/profile-fields"
import { pageApi, pageKeys, publicSite } from "@/features/community/page-api"
import { RegistryEditor } from "@/features/tournaments/registry-editor"
import { TeamRosterSheet } from "@/features/tournaments/team-roster-sheet"
import { tournamentKeys } from "@/features/tournaments/tournament-api"
import { useRecords, useRosters } from "@/features/esports/data/use-esports-data"
import {
  AccessGate,
  Crumbs,
  EsportsPage,
  LoadError,
  matchPath,
  type Access,
} from "@/features/esports/pages/esports-shell"
import { competitionApi, competitionKeys } from "./competition-api"
import { CompetitionStatistics } from "./competition-statistics"
import { OrganizationPicker } from "./organization-picker"

const steps = ["Thông tin", "Đội tham dự", "Đội hình", "Thể thức", "Lịch & kết quả", "Kiểm tra & công bố"]
const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm"
export function CompetitionWorkspace() {
  return <AccessGate>{(access) => <Loader access={access} />}</AccessGate>
}
function Loader({ access }: { access: Access }) {
  const { tournamentId = "" } = useParams()
  const query = useQuery({
    queryKey: [...competitionKeys, access.actorKey, tournamentId],
    queryFn: () => competitionApi.read(tournamentId),
  })
  if (query.isError)
    return (
      <EsportsPage>
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      </EsportsPage>
    )
  if (!query.data)
    return (
      <EsportsPage>
        <p>Đang tải không gian giải đấu…</p>
      </EsportsPage>
    )
  return <Workspace entry={query.data} access={access} />
}
function Workspace({ entry, access }: { entry: CompetitionView; access: Access }) {
  const client = useQueryClient()
  const [params, setParams] = useSearchParams()
  const step = Math.min(5, Math.max(0, Number(params.get("step")) || 0))
  const [plan, setPlan] = useState(entry.content.plan)
  const [baseline, setBaseline] = useState(entry.content.plan)
  const [draftVersion, setDraftVersion] = useState(entry.version)
  const dirty = JSON.stringify(plan) !== JSON.stringify(baseline)
  const [notice, setNotice] = useState("")
  const [editing, setEditing] = useState(false)
  const [roster, setRoster] = useState<string | null>(null)
  const [preview, setPreview] = useState<PlannedMatch[] | null>(null)
  const [opponent, setOpponent] = useState(3)
  const [matchStage, setMatchStage] = useState("")
  const [matchPage, setMatchPage] = useState(0)
  const teams = useRecords("teams"),
    players = useRecords("players"),
    tournaments = useRecords("tournaments")
  const series = useRecords("series")
  const rosters = useRosters(entry.id)
  const organization = useQuery({
    queryKey: [...pageKeys, access.actorKey, plan.organizerPageId],
    queryFn: () => pageApi.read(plan.organizerPageId!),
    enabled: !!plan.organizerPageId,
  })
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (!dirty) {
      setPlan(entry.content.plan)
      setBaseline(entry.content.plan)
      setDraftVersion(entry.version)
    }
  }, [entry.content.plan])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])
  const mutate = useMutation({
    mutationFn: async (action: "save" | "publish" | "withdraw" | "materialize") => {
      let current = { ...entry, version: draftVersion }
      if (dirty || action === "save") current = await competitionApi.save(current, plan)
      return action === "save" ? current : competitionApi.action(current, action)
    },
    onSuccess: async (value) => {
      setPlan(value.content.plan)
      setBaseline(value.content.plan)
      setDraftVersion(value.version)
      setNotice("Đã lưu thay đổi.")
      client.setQueryData([...competitionKeys, access.actorKey, entry.id], value)
      await client.invalidateQueries({ queryKey: tournamentKeys.all })
    },
  })
  const generate = useMutation({
    mutationFn: (stage: CompetitionStage) => competitionApi.preview(plan, stage.code, opponent),
    onSuccess: setPreview,
  })
  const change = <K extends keyof CompetitionPlan>(key: K, value: CompetitionPlan[K]) => {
    setPlan((old) => ({ ...old, [key]: value }))
    setNotice("")
  }
  const teamMap = Object.fromEntries((teams.data || []).map((row) => [row.id, row.content]))
  const teamName = (id: string) => teamMap[id]?.name || "Đội chưa có thông tin"
  const selectedTeam = teams.data?.find((row) => row.id === roster)
  const event = tournaments.data?.find((row) => row.id === entry.id)
  const checks = [
    { ok: !!plan.sourceUrl, label: "Nguồn kiểm chứng của giải", step: 0 },
    { ok: plan.entrants.length >= 2, label: "Có ít nhất hai đội tham dự", step: 1 },
    {
      ok:
        plan.entrants.length > 0 &&
        plan.entrants.every((team) => rosters.data?.some((row) => row.content.teamId === team.teamId)),
      label: "Đội hình được khai báo cho từng đội",
      step: 2,
    },
    { ok: plan.stages.length > 0, label: "Thể thức và tiêu chí xếp hạng", step: 3 },
    { ok: plan.matches.length > 0, label: "Lịch đấu đã tạo", step: 4 },
    {
      ok: plan.matches.length > 0 && plan.matches.every((match) => !!match.scheduledAt),
      label: "Giờ thi đấu đầy đủ",
      step: 4,
    },
    { ok: entry.content.resolved.every((match) => match.consistent), label: "Kết quả khớp các suất đi tiếp", step: 4 },
    {
      ok: !!plan.organizerPageId && !!organization.data?.published,
      label: "Tổ chức đã liên kết và công bố hồ sơ",
      step: 0,
    },
  ]
  const go = (value: number) => setParams({ step: String(value) })
  const updateMatch = (key: string, patch: Partial<PlannedMatch>) =>
    change(
      "matches",
      plan.matches.map((match) => (match.key === key ? { ...match, ...patch } : match)),
    )
  const matchingFixtures = plan.matches.filter((match) => !matchStage || match.stageCode === matchStage)
  const safeMatchPage = Math.min(matchPage, Math.max(0, Math.ceil(matchingFixtures.length / 12) - 1))
  return (
    <EsportsPage>
      <Crumbs items={[{ label: "Giải đấu", to: "/tournaments" }, { label: entry.content.tournament.name }]} />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="type-meta">KHÔNG GIAN GIẢI ĐẤU · {entry.publishedAt ? "Đã công bố" : "Bản nháp"}</p>
          <h1 className="type-page-title mt-1">{entry.content.tournament.name}</h1>
          <p className="type-body mt-2 text-muted-foreground">
            Từ danh sách tham dự đến kết quả, quản lý theo từng bước.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {entry.publishedAt && (
            <a
              className="inline-flex items-center gap-2 text-sm underline"
              href={`${publicSite}/competitions/${entry.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Xem trang <ExternalLink size={14} />
            </a>
          )}
          {access.canWrite && (
            <Button disabled={mutate.isPending || !dirty} onClick={() => mutate.mutate("save")}>
              <Save size={16} /> Lưu bản nháp
            </Button>
          )}
        </div>
      </header>
      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label="Tiến trình tạo giải">
        {steps.map((label, index) => (
          <button
            key={label}
            onClick={() => go(index)}
            aria-current={step === index ? "step" : undefined}
            className={`rounded-lg border p-3 text-left text-sm ${step === index ? "border-primary bg-primary/10" : "bg-card hover:bg-muted"}`}
          >
            <span className="type-meta block mb-1">BƯỚC {index + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      {dirty && (
        <p className="type-meta" role="status">
          Có thay đổi chưa lưu. Bản công khai chỉ cập nhật khi bạn công bố.
        </p>
      )}
      {notice && (
        <p className="type-body text-green-600" role="status">
          {notice}
        </p>
      )}
      {(mutate.error || generate.error) && (
        <LoadError
          error={mutate.error || generate.error}
          onRetry={() => {
            mutate.reset()
            generate.reset()
          }}
        />
      )}
      {blocker.state === "blocked" && (
        <div role="alertdialog" aria-label="Thay đổi chưa lưu" className="rounded-xl border bg-card p-5">
          <p className="mb-3">Bạn đang có thay đổi chưa lưu.</p>
          <Button variant="outline" onClick={() => blocker.reset()}>
            Ở lại chỉnh sửa
          </Button>{" "}
          <Button variant="destructive" onClick={() => blocker.proceed()}>
            Rời trang, bỏ thay đổi
          </Button>
        </div>
      )}
      <fieldset disabled={!access.canWrite || mutate.isPending} className="min-w-0 space-y-5">
        {step === 0 && (
          <>
            <Section title="Thông tin giải" description="Tên, thời gian, khu vực và hình ảnh của mùa giải.">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="type-body">
                  {entry.content.tournament.startsOn || "Chưa có ngày bắt đầu"} →{" "}
                  {entry.content.tournament.endsOn || "Chưa có ngày kết thúc"}
                </p>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  Chỉnh sửa thông tin cơ bản
                </Button>
              </div>
            </Section>
            <Section title="Đơn vị tổ chức">
              <OrganizationPicker
                value={plan.organizerPageId}
                actorKey={access.actorKey}
                canWrite={access.canWrite}
                onSelect={(profile) => {
                  setPlan((current) => ({
                    ...current,
                    organizerPageId: profile?.id || null,
                    organizer: profile?.content?.name || "",
                  }))
                  setNotice("")
                }}
              />
            </Section>
            <Section title="Hệ thống giải & nguồn thông tin">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Hệ thống giải" value={plan.circuit} onChange={(e) => change("circuit", e.target.value)} />
                <Field
                  label="Nguồn kiểm chứng"
                  type="url"
                  placeholder="https://…"
                  value={plan.sourceUrl}
                  onChange={(e) => change("sourceUrl", e.target.value)}
                />
                <Field
                  label="Quỹ giải thưởng"
                  value={plan.prizePool}
                  onChange={(e) => change("prizePool", e.target.value)}
                />
                <Field
                  label="Đơn vị tiền tệ"
                  value={plan.currency}
                  onChange={(e) => change("currency", e.target.value)}
                />
                <Field
                  label="Múi giờ của giải"
                  value={plan.timezone}
                  onChange={(e) => change("timezone", e.target.value)}
                />
              </div>
              <label className="grid gap-2">
                <span className="type-label">Giới thiệu & quy định bổ sung</span>
                <Textarea rows={5} value={plan.notes} onChange={(e) => change("notes", e.target.value)} />
              </label>
            </Section>
            <Section title="Địa điểm theo giai đoạn">
              {plan.venues.map((venue, index) => (
                <div key={index} className="grid items-end gap-3 md:grid-cols-4">
                  <Field
                    label="Địa điểm"
                    value={venue.name}
                    onChange={(e) =>
                      change(
                        "venues",
                        plan.venues.map((v, i) => (i === index ? { ...v, name: e.target.value } : v)),
                      )
                    }
                  />
                  <Field
                    label="Thành phố"
                    value={venue.city}
                    onChange={(e) =>
                      change(
                        "venues",
                        plan.venues.map((v, i) => (i === index ? { ...v, city: e.target.value } : v)),
                      )
                    }
                  />
                  <Field
                    label="Giai đoạn"
                    value={venue.stageCode}
                    onChange={(e) =>
                      change(
                        "venues",
                        plan.venues.map((v, i) => (i === index ? { ...v, stageCode: e.target.value } : v)),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    onClick={() =>
                      change(
                        "venues",
                        plan.venues.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Bỏ địa điểm
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() => change("venues", [...plan.venues, { name: "", city: "", stageCode: "" }])}
              >
                <Plus size={16} /> Thêm địa điểm
              </Button>
            </Section>
          </>
        )}
        {(step === 1 || step === 2) && (
          <Section
            title={step === 1 ? `Đội tham dự · ${plan.entrants.length}` : "Đội hình của mùa giải"}
            description={
              step === 1
                ? "Danh sách này độc lập với lịch đấu. Tạo hồ sơ đội một lần, sử dụng lại ở các mùa."
                : "Ghi nhận tuyển thủ, vị trí và thời gian đăng ký riêng cho giải này."
            }
          >
            {plan.entrants.map((entry, index) => (
              <div key={entry.teamId} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <span className="type-label w-6 text-muted-foreground">{index + 1}</span>
                <strong className="type-body min-w-40 flex-1">{teamName(entry.teamId)}</strong>
                {step === 1 ? (
                  <>
                    <select
                      aria-label={`Trạng thái ${teamName(entry.teamId)}`}
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                      value={entry.status || "REGISTERED"}
                      onChange={(e) =>
                        change(
                          "entrants",
                          plan.entrants.map((row) =>
                            row.teamId === entry.teamId ? { ...row, status: e.target.value } : row,
                          ),
                        )
                      }
                    >
                      {Object.entries({
                        REGISTERED: "Đã đăng ký",
                        INVITED: "Khách mời",
                        QUALIFIED: "Vượt vòng loại",
                        WITHDRAWN: "Rút lui",
                      }).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Bỏ ${teamName(entry.teamId)}`}
                      disabled={plan.matches.some(
                        (match) => match.a.teamId === entry.teamId || match.b.teamId === entry.teamId,
                      )}
                      onClick={() =>
                        change(
                          "entrants",
                          plan.entrants.filter((row) => row.teamId !== entry.teamId),
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="type-meta">
                      {rosters.data?.filter((row) => row.content.teamId === entry.teamId).length || 0} tuyển thủ
                    </span>
                    <Button variant="outline" onClick={() => setRoster(entry.teamId)}>
                      Quản lý đội hình
                    </Button>
                  </>
                )}
              </div>
            ))}
            {!plan.entrants.length && (
              <p className="type-body text-muted-foreground">
                Chưa có đội tham dự. Thêm đội ở bước 2 trước khi khai báo đội hình.
              </p>
            )}
            {step === 1 && (
              <div className="flex flex-wrap items-center gap-3">
                <select
                  aria-label="Thêm đội tham dự"
                  className={`${selectClass} max-w-md`}
                  value=""
                  onChange={(e) =>
                    e.target.value &&
                    change("entrants", [...plan.entrants, { teamId: e.target.value, status: "REGISTERED", note: "" }])
                  }
                >
                  <option value="">Chọn đội để thêm…</option>
                  {teams.data
                    ?.filter((team) => !plan.entrants.some((row) => row.teamId === team.id))
                    .map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.content.name}
                      </option>
                    ))}
                </select>
                <Link className="text-sm underline" to="/teams">
                  Tạo hồ sơ đội
                </Link>
              </div>
            )}
            {step === 2 && (
              <Link className="text-sm underline" to="/players">
                Quản lý hồ sơ tuyển thủ
              </Link>
            )}
          </Section>
        )}
        {step === 3 && (
          <>
            <Section
              title="Thiết lập thể thức"
              description="Mẫu AOG gồm vòng bảng hai lượt BO5, sáu đội vào playoffs BO7. Kiểm chứng điểm số, tiêu chí phụ và nhánh đấu bằng điều lệ chính thức trước khi công bố."
            >
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  disabled={plan.matches.length > 0}
                  onClick={() => change("stages", aogStages(plan.sourceUrl))}
                >
                  Dùng mẫu AOG · 9 đội
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    change("stages", [
                      ...plan.stages,
                      {
                        ...aogStages(plan.sourceUrl)[0]!,
                        code: `STAGE_${plan.stages.length + 1}`,
                        name: "Giai đoạn mới",
                        format: "CUSTOM",
                        legs: 1,
                        advance: 0,
                      },
                    ])
                  }
                >
                  <Plus size={16} /> Thêm giai đoạn
                </Button>
              </div>
            </Section>
            {plan.stages.map((stage, index) => (
              <StageEditor
                key={stage.code}
                stage={stage}
                removable={!plan.matches.some((match) => match.stageCode === stage.code)}
                onChange={(value) =>
                  change(
                    "stages",
                    plan.stages.map((row, i) => (i === index ? value : row)),
                  )
                }
                onRemove={() =>
                  change(
                    "stages",
                    plan.stages.filter((_, i) => i !== index),
                  )
                }
              />
            ))}
          </>
        )}
        {step === 4 && (
          <>
            <Section
              title="Tạo lịch & suất đi tiếp"
              description="Xem trước lịch rồi thêm vào bản nháp. Các suất thắng/thua được giải quyết từ kết quả trận trước; không cần tạo đội giả."
            >
              <div className="flex flex-wrap items-end gap-3">
                {plan.stages
                  .filter((stage) => ["ROUND_ROBIN", "DOUBLE_ELIMINATION"].includes(stage.format))
                  .map((stage) => (
                    <Button
                      key={stage.code}
                      variant="outline"
                      disabled={
                        generate.isPending ||
                        plan.matches.some((match) => match.stageCode === stage.code && match.seriesId)
                      }
                      onClick={() => generate.mutate(stage)}
                    >
                      Tạo lịch {stage.name}
                    </Button>
                  ))}
                <label className="grid gap-2">
                  <span className="type-label">Đối thủ do hạt giống 1 chọn</span>
                  <select
                    className={selectClass}
                    value={opponent}
                    onChange={(e) => setOpponent(Number(e.target.value))}
                  >
                    <option value={3}>Hạt giống 3</option>
                    <option value={4}>Hạt giống 4</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((seed) => (
                  <label key={seed} className="grid gap-2">
                    <span className="type-label">Hạt giống {seed}</span>
                    <select
                      className={selectClass}
                      value={plan.playoffSeeds[seed] || ""}
                      onChange={(e) => {
                        const values = { ...plan.playoffSeeds }
                        if (e.target.value) values[seed] = e.target.value
                        else delete values[seed]
                        change("playoffSeeds", values)
                      }}
                    >
                      <option value="">Chưa xác định</option>
                      {plan.entrants
                        .filter((entry) => entry.status !== "WITHDRAWN")
                        .map((entry) => (
                          <option key={entry.teamId} value={entry.teamId}>
                            {teamName(entry.teamId)}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
              </div>
              <Button onClick={() => mutate.mutate("materialize")} disabled={mutate.isPending || !plan.matches.length}>
                Mở nhập kết quả cho các cặp đã xác định
              </Button>
            </Section>
            {preview && (
              <Section
                title={`Xem trước · ${preview.length} trận`}
                description="Thao tác sẽ thay lịch nháp chưa liên kết của giai đoạn này."
              >
                <div className="max-h-64 overflow-auto space-y-2">
                  {preview.map((match) => (
                    <p className="type-body" key={match.key}>
                      {match.label} · {slotLabel(match.a, teamMap)} — {slotLabel(match.b, teamMap)} · BO{match.bestOf}
                    </p>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      const stage = preview[0]?.stageCode
                      change("matches", [...plan.matches.filter((match) => match.stageCode !== stage), ...preview])
                      setPreview(null)
                    }}
                  >
                    Dùng lịch này
                  </Button>
                  <Button variant="outline" onClick={() => setPreview(null)}>
                    Hủy
                  </Button>
                </div>
              </Section>
            )}
            <Section
              title={`Lịch thi đấu · ${plan.matches.length}`}
              description="Giờ nhập theo múi giờ máy của bạn, lưu và hiển thị có kèm múi giờ."
            >
              <label className="grid gap-2 max-w-sm">
                <span className="type-label">Lọc giai đoạn</span>
                <select
                  className={selectClass}
                  value={matchStage}
                  onChange={(event) => {
                    setMatchStage(event.target.value)
                    setMatchPage(0)
                  }}
                >
                  <option value="">Tất cả giai đoạn</option>
                  {plan.stages.map((stage) => (
                    <option key={stage.code} value={stage.code}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="max-h-[650px] overflow-auto space-y-3">
                {matchingFixtures.slice(safeMatchPage * 12, (safeMatchPage + 1) * 12).map((match) => {
                  const index = plan.matches.findIndex((row) => row.key === match.key)
                  const resolved = entry.content.resolved.find((row) => row.key === match.key)
                  const actual = series.data?.find((row) => row.id === match.seriesId)
                  return (
                    <details key={match.key} className="rounded-lg border p-4 space-y-3">
                      <summary className="cursor-pointer text-sm">
                        <span className="type-meta">
                          {match.label} · BO{match.bestOf}
                        </span>
                        <span className="block mt-1">
                          {slotLabel(match.a, teamMap)}{" "}
                          <strong>
                            {resolved?.scoreA ?? "–"} : {resolved?.scoreB ?? "–"}
                          </strong>{" "}
                          {slotLabel(match.b, teamMap)}
                        </span>
                        <span className="type-meta">
                          {match.scheduledAt
                            ? new Date(match.scheduledAt).toLocaleString("vi-VN")
                            : "Chưa có giờ thi đấu"}{" "}
                          · Mở để chỉnh sửa{match.seriesId ? " / nhập kết quả" : ""}
                        </span>
                      </summary>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="type-label">
                          {match.key} · {match.label} · BO{match.bestOf}
                        </span>
                        {actual && (
                          <Link className="text-sm underline" to={matchPath(entry.id, actual.id)}>
                            Nhập kết quả & ván đấu <ChevronRight className="inline" size={14} />
                          </Link>
                        )}
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <Field
                          label="Tên trận"
                          value={match.label}
                          onChange={(event) => updateMatch(match.key, { label: event.target.value })}
                        />
                        <label className="grid gap-2">
                          <span className="type-label">Giai đoạn</span>
                          <select
                            className={selectClass}
                            value={match.stageCode}
                            onChange={(event) => updateMatch(match.key, { stageCode: event.target.value })}
                          >
                            {plan.stages.map((stage) => (
                              <option key={stage.code} value={stage.code}>
                                {stage.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Field
                          label="Vòng đấu"
                          type="number"
                          min={1}
                          value={match.round}
                          onChange={(event) => updateMatch(match.key, { round: Number(event.target.value) })}
                        />
                        <Field
                          label="BO của trận"
                          type="number"
                          min={1}
                          max={9}
                          step={2}
                          disabled={!!match.seriesId}
                          value={match.bestOf}
                          onChange={(event) => updateMatch(match.key, { bestOf: Number(event.target.value) })}
                        />
                        <SlotEditor
                          label="Đội A"
                          value={match.a}
                          teams={teamMap}
                          entrants={plan.entrants}
                          previous={plan.matches.slice(0, index)}
                          disabled={!!match.seriesId}
                          onChange={(a) => updateMatch(match.key, { a })}
                        />
                        <SlotEditor
                          label="Đội B"
                          value={match.b}
                          teams={teamMap}
                          entrants={plan.entrants}
                          previous={plan.matches.slice(0, index)}
                          disabled={!!match.seriesId}
                          onChange={(b) => updateMatch(match.key, { b })}
                        />
                        <Field
                          label={`Giờ đấu (${Intl.DateTimeFormat().resolvedOptions().timeZone})`}
                          type="datetime-local"
                          value={localTime(match.scheduledAt)}
                          onChange={(e) =>
                            updateMatch(match.key, {
                              scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                            })
                          }
                        />
                      </div>
                      {resolved && (
                        <p className={`type-meta ${resolved.consistent ? "" : "text-destructive"}`}>
                          {resolved.teamAId ? teamName(resolved.teamAId) : slotLabel(match.a, teamMap)}{" "}
                          {resolved.scoreA ?? "–"} : {resolved.scoreB ?? "–"}{" "}
                          {resolved.teamBId ? teamName(resolved.teamBId) : slotLabel(match.b, teamMap)}
                          {!resolved.consistent && " · Kết quả không còn khớp suất thi đấu. Cần kiểm tra."}
                        </p>
                      )}
                      {!match.seriesId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            change(
                              "matches",
                              plan.matches.filter((row) => row.key !== match.key),
                            )
                          }
                        >
                          Bỏ trận nháp
                        </Button>
                      )}
                    </details>
                  )
                })}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="type-meta">
                  {matchingFixtures.length} trận · Trang {safeMatchPage + 1}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={!safeMatchPage} onClick={() => setMatchPage(safeMatchPage - 1)}>
                    Trước
                  </Button>
                  <Button
                    variant="outline"
                    disabled={(safeMatchPage + 1) * 12 >= matchingFixtures.length}
                    onClick={() => setMatchPage(safeMatchPage + 1)}
                  >
                    Sau
                  </Button>
                </div>
              </div>
              <Button
                variant="outline"
                disabled={!plan.stages.length}
                onClick={() =>
                  change("matches", [
                    ...plan.matches,
                    {
                      key: `M_${crypto.randomUUID().slice(0, 8)}`,
                      stageCode: plan.stages[0]!.code,
                      round: 1,
                      label: "Trận bổ sung",
                      bestOf: plan.stages[0]!.bestOf,
                      a: { type: "TBD", label: "Đội A" },
                      b: { type: "TBD", label: "Đội B" },
                    },
                  ])
                }
              >
                <Plus size={16} /> Thêm trận thủ công
              </Button>
            </Section>
          </>
        )}
      </fieldset>
      {step === 5 && (
        <>
          <Section
            title="Kiểm tra trước khi công bố"
            description="Đội hình và giờ đấu có thể bổ sung sau. Mỗi lần công bố sẽ chụp lại thông tin giải, đội hình, lịch và kết quả hiện tại."
          >
            {checks.map((check) => (
              <button
                key={check.label}
                className="flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm"
                onClick={() => go(check.step)}
              >
                {check.ok ? (
                  <Check size={18} className="text-green-600" />
                ) : (
                  <span className="h-4 w-4 rounded-full border" />
                )}
                {check.label}
                <ChevronRight className="ml-auto" size={16} />
              </button>
            ))}
            <div className="flex flex-wrap gap-3">
              {access.canPublish && (
                <>
                  <Button
                    disabled={
                      mutate.isPending ||
                      (dirty && !access.canWrite) ||
                      (!!plan.organizerPageId && !organization.data?.published) ||
                      !checks[0]!.ok ||
                      !checks[1]!.ok ||
                      !checks[3]!.ok
                    }
                    onClick={() => mutate.mutate("publish")}
                  >
                    {entry.publishedAt ? "Cập nhật bản công khai" : "Công bố giải đấu"}
                  </Button>
                  {entry.publishedAt && (
                    <Button variant="outline" disabled={mutate.isPending} onClick={() => mutate.mutate("withdraw")}>
                      Gỡ khỏi trang công khai
                    </Button>
                  )}
                </>
              )}
            </div>
          </Section>
          {entry.content.standings.map((table) => (
            <Section
              key={table.stageCode}
              title={`Bảng xếp hạng · ${plan.stages.find((stage) => stage.code === table.stageCode)?.name || table.stageCode}`}
              description={
                table.complete
                  ? "Đã hoàn tất các trận của giai đoạn."
                  : "Tạm tính theo kết quả đã nhập. Chưa xác nhận suất đi tiếp."
              }
            >
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      {["Hạng", "Đội", "Trận", "Thắng", "Thua", "Ván", "Điểm"].map((label) => (
                        <th className="type-label p-3" key={label}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row) => (
                      <tr key={row.teamId} className="border-b">
                        <td className="p-3">
                          {row.rank}
                          {row.tied ? "=" : ""}
                        </td>
                        <td className="p-3">
                          {teamName(row.teamId)}
                          {row.qualified && " · Đi tiếp"}
                        </td>
                        <td className="p-3">{row.played}</td>
                        <td className="p-3">{row.won}</td>
                        <td className="p-3">{row.lost}</td>
                        <td className="p-3">
                          {row.gameWins}–{row.gameLosses}
                        </td>
                        <td className="p-3">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          ))}
        </>
      )}
      {step === 5 && (
        <CompetitionStatistics
          seriesIds={entry.content.plan.matches.flatMap((match) => (match.seriesId ? [match.seriesId] : []))}
        />
      )}
      <footer className="flex justify-between border-t pt-4">
        <Button variant="outline" disabled={step === 0} onClick={() => go(step - 1)}>
          Bước trước
        </Button>
        <Button variant="outline" disabled={step === 5} onClick={() => go(step + 1)}>
          Tiếp tục <ChevronRight size={16} />
        </Button>
      </footer>
      {editing && event && (
        <RegistryEditor
          open
          kind="tournaments"
          entry={event}
          teams={teams.data || []}
          tournaments={tournaments.data || []}
          onClose={() => setEditing(false)}
        />
      )}
      {selectedTeam && (
        <TeamRosterSheet
          team={selectedTeam}
          tournaments={tournaments.data || []}
          players={players.data || []}
          initialTournamentId={entry.id}
          canWrite={access.canWrite}
          actorKey={access.actorKey}
          onClose={() => setRoster(null)}
        />
      )}
    </EsportsPage>
  )
}
function StageEditor({
  stage,
  onChange,
  onRemove,
  removable,
}: {
  stage: CompetitionStage
  onChange: (value: CompetitionStage) => void
  onRemove: () => void
  removable: boolean
}) {
  return (
    <Section title={stage.name || "Giai đoạn"}>
      <div className="grid gap-4 md:grid-cols-3">
        <Field
          label="Tên giai đoạn"
          value={stage.name}
          onChange={(e) => onChange({ ...stage, name: e.target.value })}
        />
        <label className="grid gap-2">
          <span className="type-label">Thể thức</span>
          <select
            className={selectClass}
            value={stage.format}
            onChange={(e) => onChange({ ...stage, format: e.target.value })}
          >
            {Object.entries({
              ROUND_ROBIN: "Vòng tròn",
              DOUBLE_ELIMINATION: "Nhánh thắng / thua",
              SINGLE_ELIMINATION: "Loại trực tiếp",
              CUSTOM: "Tự thiết lập",
            }).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="BO"
          type="number"
          min={1}
          max={9}
          step={2}
          value={stage.bestOf}
          onChange={(e) => onChange({ ...stage, bestOf: Number(e.target.value) })}
        />
        {stage.format === "ROUND_ROBIN" && (
          <>
            {(
              [
                ["legs", "Số lượt"],
                ["winPoints", "Điểm thắng"],
                ["lossPoints", "Điểm thua"],
                ["advance", "Số đội đi tiếp"],
              ] as const
            ).map(([key, label]) => (
              <Field
                key={key}
                label={label}
                type="number"
                min={key === "legs" ? 1 : 0}
                max={key === "legs" ? 4 : 64}
                value={stage[key]}
                onChange={(e) => onChange({ ...stage, [key]: Number(e.target.value) })}
              />
            ))}
            <label className="grid gap-2 md:col-span-2">
              <span className="type-label">Tiêu chí phụ, theo thứ tự</span>
              <select
                className={selectClass}
                value={stage.tieBreakers.join(",")}
                onChange={(e) => onChange({ ...stage, tieBreakers: e.target.value ? e.target.value.split(",") : [] })}
              >
                <option value="GAME_DIFF,GAME_WINS">Hiệu số ván → Số ván thắng</option>
                <option value="HEAD_TO_HEAD,GAME_DIFF,GAME_WINS">Đối đầu → Hiệu số ván → Số ván thắng</option>
                <option value="GAME_DIFF,HEAD_TO_HEAD,GAME_WINS">Hiệu số ván → Đối đầu → Số ván thắng</option>
                <option value="">Chưa phân hạng khi bằng điểm</option>
              </select>
            </label>
          </>
        )}
        <Field
          label="Nguồn điều lệ"
          type="url"
          value={stage.sourceUrl}
          onChange={(e) => onChange({ ...stage, sourceUrl: e.target.value })}
        />
        <Field
          label="Phiên bản / quy tắc cấm chọn"
          value={stage.patchNote}
          onChange={(e) => onChange({ ...stage, patchNote: e.target.value })}
        />
      </div>
      <Button variant="ghost" disabled={!removable} onClick={onRemove}>
        Bỏ giai đoạn
      </Button>
    </Section>
  )
}
function SlotEditor({
  label,
  value,
  teams,
  entrants,
  previous,
  disabled,
  onChange,
}: {
  label: string
  value: CompetitionSlot
  teams: CompetitionView["content"]["teams"]
  entrants: CompetitionPlan["entrants"]
  previous: PlannedMatch[]
  disabled: boolean
  onChange: (value: CompetitionSlot) => void
}) {
  const selected =
    value.type === "TEAM"
      ? `TEAM:${value.teamId}`
      : value.type === "SEED"
        ? `SEED:${value.seed}`
        : value.type === "TBD"
          ? "TBD"
          : `${value.type}:${value.matchKey}`
  return (
    <label className="grid gap-2">
      <span className="type-label">{label}</span>
      <select
        className={selectClass}
        disabled={disabled}
        value={selected}
        onChange={(e) => {
          const [type, id] = e.target.value.split(":")
          onChange(
            type === "TEAM"
              ? { type, teamId: id }
              : type === "SEED"
                ? { type, seed: Number(id) }
                : type === "WINNER" || type === "LOSER"
                  ? { type, matchKey: id }
                  : { type: "TBD", label },
          )
        }}
      >
        <option value="TBD">Chưa xác định</option>
        <optgroup label="Đội đã đăng ký">
          {entrants.map((entry) => (
            <option key={entry.teamId} value={`TEAM:${entry.teamId}`}>
              {teams[entry.teamId]?.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Hạt giống">
          {Array.from({ length: Math.max(6, entrants.length) }, (_, i) => (
            <option key={i} value={`SEED:${i + 1}`}>
              Hạt giống {i + 1}
            </option>
          ))}
        </optgroup>
        <optgroup label="Kết quả trận trước">
          {previous.flatMap((match) => [
            <option key={`${match.key}-W`} value={`WINNER:${match.key}`}>
              Thắng {match.key}
            </option>,
            <option key={`${match.key}-L`} value={`LOSER:${match.key}`}>
              Thua {match.key}
            </option>,
          ])}
        </optgroup>
      </select>
    </label>
  )
}
function localTime(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
