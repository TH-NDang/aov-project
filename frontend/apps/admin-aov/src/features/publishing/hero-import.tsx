import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@aov/ui/components/button"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { parseCsv, recordArrays } from "../storage/storage-model"
import { indexImportFiles, resolveImportImage, detectImportImageBase } from "./import-files"
import { readImportZip } from "./import-archive"
import { readImportDrop } from "./import-drop"
import {
  defaultRelationMapping,
  mapRelation,
  type Relation,
  type RelationField,
  type RelationMapping,
  type RelatedImage,
} from "./import-relations"
import { RelationMappingFields } from "./relation-mapping"
import { type Request } from "./publishing-api"
import { createUploadSession, resumeUploadSession, type UploadSession } from "./import-upload-session"
import { control } from "./fields"
import {
  Upload,
  FolderOpen,
  FileArchive,
  FileJson,
  Database,
  GitCompareArrows,
  PencilLine,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
} from "lucide-react"
import { IMPORT_STATUS, ImportValue } from "./import-review"
import type { ImportContext } from "./import-context"
import { captureDataset, mergeResourceArtwork, type SourceDataset } from "./hero-source-dataset"
import { BaselineMigration } from "./baseline-migration"

import type { components } from "./generated/hero-api"
type Policy = components["schemas"]["ImportPolicy"]
type Field = components["schemas"]["ImportField"]
type Input = components["schemas"]["HeroImportRequest"]
type Plan = components["schemas"]["HeroImportPlan"]
export interface ImportActivity {
  status: "idle" | "running" | "review" | "completed" | "error"
  description: string
  completed: number
  total: number
}
interface Entry {
  relatedImages?: RelatedImage[]
  imageUrls?: Record<string, string>
  input: Input
  plan?: Plan
  error?: string
  selected: boolean
  result?: string
}
function sampleValue(value: unknown): string {
  if (value == null || value === "") return "Trống"
  if (Array.isArray(value))
    return `${value.length} mục${
      value.length && typeof value[0] === "object"
        ? ` · ${value
            .slice(0, 3)
            .map((item) => item?.name || item?.skillKey || item?.skinKey || "")
            .filter(Boolean)
            .join(", ")}`
        : ` · ${value.slice(0, 4).join(", ")}`
    }`
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    if (Array.isArray(record.values)) return `${record.values.length} chỉ số · giữ đơn vị và nguồn đi kèm`
    if (record.scaleCode)
      return `Thang ${record.scaleCode} · ${record.derived ? "quy đổi từ ảnh nguồn" : "đánh giá đã ghi nhận"}`
    return `${Object.keys(record).length} trường dữ liệu`
  }
  return String(value)
}
export function HeroImport({
  context,
  locale,
  onBusyChange,
  onActivityChange,
  request = backendRequest,
}: {
  context: ImportContext | null
  locale: string
  onBusyChange: (busy: boolean) => void
  onActivityChange?: (activity: ImportActivity) => void
  request?: Request
}) {
  const post = <T,>(path: string, body: unknown) =>
    request<T>(`/admin/heroes/import/${path}`, { method: "POST", body: JSON.stringify(body) })
  const cache = useQueryClient()
  const fields = useQuery({
    queryKey: ["hero-import-fields"],
    queryFn: () => request<Field[]>("/admin/heroes/import/fields"),
  })
  const relationFields = useQuery({
    queryKey: ["hero-import-relation-fields"],
    queryFn: () => request<Record<Relation, RelationField[]>>("/admin/heroes/import/relation-fields"),
  })
  const folderInput = useRef<HTMLInputElement>(null)
  const zipInput = useRef<HTMLInputElement>(null)
  const dataInput = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState(new Map<string, File>())
  const [base, setBase] = useState("")
  const [dataPath, setDataPath] = useState("")
  const [sourceName, setSourceName] = useState("")
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const [arrayChoices, setArrayChoices] = useState<Record<string, Record<string, unknown>[]>>({})
  const [relations, setRelations] = useState<Record<Relation, RelationMapping>>({
    skills: { variants: "", fields: {} },
    skins: { variants: "", fields: {} },
  })
  const [activity, setActivity] = useState<ImportActivity>({ status: "idle", description: "", completed: 0, total: 0 })
  useEffect(() => {
    onActivityChange?.(activity)
  }, [activity, onActivityChange])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [mode, setMode] = useState<Input["mode"]>("BASELINE")
  const [step, setStep] = useState(1)
  const [fileName, setFileName] = useState("")
  const [capture, setCapture] = useState<SourceDataset | null>(null)
  const [artworkMerged, setArtworkMerged] = useState(false)
  const [progress, setProgress] = useState("")
  const [filter, setFilter] = useState("ALL")
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [idColumn, setIdColumn] = useState("")
  const [policies, setPolicies] = useState<Record<string, Policy>>({})
  const [entries, setEntries] = useState<Entry[]>([])
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set())
  const [expandedImages, setExpandedImages] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [pendingTransfer, setPendingTransfer] = useState(false)
  useEffect(() => {
    if (!pendingTransfer) return
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warnBeforeLeaving)
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving)
  }, [pendingTransfer])
  useEffect(() => {
    onBusyChange(busy)
    return () => onBusyChange(false)
  }, [busy, onBusyChange])
  const [error, setError] = useState("")
  const submission = useRef<UploadSession | null>(null)
  const [awaitingRetry, setAwaitingRetry] = useState(false)
  const columns = [...new Set(rows.flatMap(Object.keys))].filter((key) => !key.startsWith("__"))
  function adoptRows(next: Record<string, unknown>[]) {
    if (!next?.length || next.length > 200) throw new Error("Mỗi lần nhập từ 1 đến 200 tướng.")
    setRows(next)
    setError("")
    setActivity({ status: "review", description: "Chờ ánh xạ cột", completed: 1, total: 1 })
    const columns = [...new Set(next.flatMap(Object.keys))].filter((key) => !key.startsWith("__"))
    setMapping(
      Object.fromEntries(
        (fields.data ?? []).filter((field) => columns.includes(field.key)).map((field) => [field.key, field.key]),
      ),
    )
    setIdColumn(columns.includes("code") ? "code" : columns.includes("id") ? "id" : "")
    setRelations({
      skills: defaultRelationMapping(
        next.find((row) => Array.isArray(row.skills) && row.skills.length)?.skills,
        "skills",
      ),
      skins: defaultRelationMapping(next.find((row) => Array.isArray(row.skins) && row.skins.length)?.skins, "skins"),
    })
    setPolicies({})
    setArrayChoices({})
    setStep(2)
  }
  function adoptFiles(index: Map<string, File>, label: string) {
    setCapture(null)
    setArtworkMerged(false)
    setPendingTransfer(false)
    setFiles(index)
    setSourceName(label)
    setDataPath("")
    setFileName("")
    setBase("")
    setRows([])
    setEntries([])
    setArrayChoices({})
    setStep(1)
    setError("")
    submission.current = null
  }
  async function chooseZip(file: File) {
    setBusy(true)
    setError("")
    setProgress("Đang đọc ZIP trên máy của bạn")
    setActivity({ status: "running", description: "Đang đọc ZIP", completed: 0, total: 1 })
    try {
      adoptFiles(await readImportZip(file), file.name)
      setActivity({ status: "review", description: "Chọn JSON/CSV trong ZIP", completed: 1, total: 1 })
    } catch (cause) {
      setError(errorMessage(cause))
      setActivity({ status: "error", description: "Không đọc được ZIP", completed: 0, total: 1 })
    } finally {
      setBusy(false)
    }
  }
  async function dropSource(pending: Promise<Map<string, File>>) {
    setBusy(true)
    setError("")
    setProgress("Đang đọc dữ liệu đã thả")
    try {
      const dropped = await pending
      const single = dropped.size === 1 ? [...dropped.values()][0] : undefined
      if (single && /\.zip$/i.test(single.name)) await chooseZip(single)
      else if (single && /\.(json|csv)$/i.test(single.name)) await load(single)
      else {
        if (![...dropped.keys()].some((path) => /\.(json|csv)$/i.test(path)))
          throw new Error("Hãy thả JSON/CSV, một ZIP hoặc thư mục chứa dữ liệu và ảnh.")
        if ([...dropped.keys()].some((path) => /\.zip$/i.test(path)))
          throw new Error("Hãy thả từng ZIP riêng hoặc giải nén rồi chọn thư mục.")
        adoptFiles(dropped, "Dữ liệu kéo thả")
      }
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }
  function chooseFolder(selected: File[]) {
    if (!selected.length) return
    try {
      adoptFiles(indexImportFiles(selected), selected[0].webkitRelativePath.split("/")[0] || "Thư mục")
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }
  async function load(file: File, path?: string) {
    setBusy(true)
    setProgress("Đang đọc file")
    setActivity({ status: "running", description: "Đang đọc file", completed: 0, total: 1 })
    setError("")
    setEntries([])
    setArrayChoices({})
    setRows([])
    setStep(1)
    setDataPath(path ?? "")
    setCapture(null)
    setArtworkMerged(false)
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("File tối đa 5 MB.")
      const text = await file.text()
      const parsed = file.name.toLowerCase().endsWith(".csv") ? null : JSON.parse(text)
      const recognized = captureDataset(parsed)
      if (recognized) {
        setFileName(path ?? file.name)
        adoptRows(recognized.rows)
        setPolicies({ skills: "OVERWRITE" })
        setCapture(recognized)
        setMode("BASELINE")
        return
      }
      const arrays = file.name.toLowerCase().endsWith(".csv") ? { rows: parseCsv(text) } : recordArrays(parsed)
      setFileName(path ?? file.name)
      const choices = Object.fromEntries(Object.entries(arrays).filter(([, rows]) => rows.length))
      if (!Object.keys(choices).length) throw new Error("File không có mảng bản ghi để nhập.")
      setBase(detectImportImageBase(choices, files, path ?? dataPath, base))
      if (Object.keys(choices).length !== 1) {
        setArrayChoices(choices)
        setRows([])
        setActivity({ status: "review", description: "Chọn mảng chứa tướng", completed: 1, total: 1 })
        return
      }
      adoptRows(Object.values(choices)[0])
      setActivity({ status: "review", description: "Chờ ánh xạ cột", completed: 1, total: 1 })
    } catch (cause) {
      setRows([])
      setError(errorMessage(cause))
      setActivity({ status: "error", description: "Không đọc được file", completed: 0, total: 1 })
    } finally {
      setBusy(false)
    }
  }
  async function preview() {
    if (!context) return
    setBusy(true)
    setError("")
    setEntries([])
    setExpandedEntries(new Set())
    setExpandedImages(new Set())
    setActivity({ status: "running", description: "Đang kiểm tra dữ liệu", completed: 0, total: rows.length })
    const next: Entry[] = []
    const seen = new Set<string>()
    try {
      for (const row of rows) {
        const code = String(row[idColumn] ?? "").trim()
        const imageUrls: Record<string, string> = {}
        setProgress(`Đang kiểm tra ${next.length + 1}/${rows.length}`)
        const input: Input = {
          code,
          rulesetId: context.rulesetId,
          contextId: context.contextId,
          mode,
          locale,
          values: {},
          policies,
        }
        try {
          if (!code || seen.has(code)) throw new Error("Mã tướng trống hoặc bị trùng trong file.")
          seen.add(code)
          for (const field of fields.data ?? []) {
            const source = mapping[field.key]
            if (!source || policies[field.key] === "SKIP") continue
            const value = row[source]
            if (field.key === "skills" || field.key === "skins") continue
            if (field.type === "image") {
              if (typeof value === "string" && value.trim()) {
                if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) input.values[field.key] = value
                else imageUrls[field.key] = value.trim()
              }
              continue
            }
            input.values[field.key] =
              field.type === "json" && typeof value === "string" && value.trim() ? JSON.parse(value) : value
          }
          const basePlan = await post<Plan>("preview", input)
          const relatedImages: RelatedImage[] = []
          for (const section of ["skills", "skins"] as const) {
            if (!mapping[section] || policies[section] === "SKIP") continue
            if (
              policies[section] !== "OVERWRITE" &&
              Array.isArray(basePlan.before[section]) &&
              (basePlan.before[section] as unknown[]).length
            )
              continue
            if (!relationFields.data?.[section])
              throw new Error("Chưa tải được các trường ánh xạ liên quan từ backend.")
            const mapped = mapRelation(
              section,
              row[mapping[section]],
              relations[section],
              basePlan.before[section],
              locale,
              relationFields.data[section],
            )
            if (!mapped.rows.length) continue
            input.values[section] = mapped.rows
            relatedImages.push(...mapped.images)
          }
          for (const key of Object.keys(imageUrls)) {
            if (policies[key] !== "OVERWRITE" && basePlan.before[key]) delete imageUrls[key]
            else resolveImportImage(imageUrls[key], files, base)
          }
          relatedImages.forEach((image) => resolveImportImage(image.source, files, base))
          const plan = input.values.skills || input.values.skins ? await post<Plan>("preview", input) : basePlan
          if (plan.revisionId !== basePlan.revisionId || plan.version !== basePlan.version)
            throw new Error(
              "Dữ liệu vừa thay đổi trong lúc ánh xạ. Hãy kiểm tra lại để giữ đúng các trường không nhập.",
            )
          next.push({
            relatedImages,
            input: { ...input, expectedRevisionId: plan.revisionId, expectedVersion: plan.version },
            plan,
            selected:
              plan.canApply &&
              (plan.changed ||
                relatedImages.length > 0 ||
                Object.keys(imageUrls).some((key) => policies[key] === "OVERWRITE" || !plan.before[key])),
            imageUrls,
          })
        } catch (cause) {
          next.push({ input, error: errorMessage(cause), selected: false })
        }
        setActivity({
          status: "running",
          description: `Đang kiểm tra: ${code}`,
          completed: next.length,
          total: rows.length,
        })
      }
      setEntries(next)
      setFilter("ALL")
      setStep(3)
      setActivity({
        status: "review",
        description: `Chờ duyệt ${next.length} tướng`,
        completed: next.length,
        total: rows.length,
      })
    } finally {
      setBusy(false)
    }
  }
  async function apply() {
    setPendingTransfer(true)
    setBusy(true)
    setError("")
    const selected = entries.filter((entry) => entry.selected && entry.plan && !entry.result)
    const total = selected.length
    setActivity({ status: "running", description: "Đang chuẩn bị import", completed: 0, total })
    try {
      if (!submission.current) {
        submission.current = await createUploadSession(
          selected.map(({ input, imageUrls, relatedImages }) => ({ input, imageUrls, relatedImages })),
          files,
          base,
          `${fileName} · ${context?.seasonName} / ${context?.patchCode}`,
        )
      }
      await resumeUploadSession(request, submission.current, files, (completed, total, description) => {
        setProgress(description)
        setActivity({ status: "running", description, completed, total })
      })
      setPendingTransfer(false)
      setAwaitingRetry(false)
      const codes = new Set(submission.current.state.entries.map((entry) => entry.input.code))
      setEntries((current) =>
        current.map((entry) =>
          codes.has(entry.input.code)
            ? { ...entry, result: "Đã gửi đến máy chủ", selected: false, error: undefined }
            : entry,
        ),
      )
      submission.current = null
      setActivity({
        status: "completed",
        description: "Đã gửi đến máy chủ · xem tiến trình bên dưới",
        completed: total,
        total,
      })
      await cache.invalidateQueries({ queryKey: ["hero-import-jobs"] })
    } catch (cause) {
      setAwaitingRetry(!!submission.current)
      setError(errorMessage(cause))
      setActivity({
        status: "error",
        description: submission.current
          ? "Chưa xác nhận đã nhận tác vụ. Gửi lại để kiểm tra."
          : "Chuẩn bị import thất bại",
        completed: 0,
        total,
      })
    } finally {
      setBusy(false)
      await cache.invalidateQueries({ queryKey: ["hero-upload-sessions"] })
    }
  }
  const modes = [
    {
      key: "BASELINE",
      title: "Dữ liệu ban đầu",
      icon: Database,
      description: "Ghi nhận trạng thái tại patch này. Phù hợp khi chưa có lịch sử hoặc bổ sung một mốc quá khứ.",
    },
    {
      key: "PATCH_UPDATE",
      title: "Cập nhật theo patch",
      icon: GitCompareArrows,
      description: "Đối chiếu mốc đã biết trước đó. Chưa có mốc so sánh sẽ được đánh dấu để bạn xử lý.",
    },
    {
      key: "CORRECTION",
      title: "Bổ sung / sửa dữ liệu",
      icon: PencilLine,
      description: "Sửa thông tin của mốc đã có tại patch này. Không tính là thay đổi của game.",
    },
  ] as const
  const eligible = (entry: Entry) =>
    !!entry.plan?.canApply &&
    !entry.error &&
    !entry.result &&
    (entry.plan.changed ||
      !!entry.relatedImages?.length ||
      Object.keys(entry.imageUrls ?? {}).some(
        (key) => entry.input.policies[key] === "OVERWRITE" || !entry.plan?.before[key],
      ))
  const selectedCount = entries.filter((e) => e.selected).length
  const shown = entries.filter(
    (e) => filter === "ALL" || (filter === "ERROR" ? !!e.error : e.plan?.classification === filter),
  )
  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-label="Import tướng">
      <div className="border-b bg-muted/30 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 type-section-title">
            <Upload className="size-4" /> Nhập dữ liệu tướng
          </h2>
          <span className="text-xs text-muted-foreground">JSON / CSV · Tối đa 5 MB / 200 tướng</span>
        </div>
        <ol className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Tiến trình import">
          {["Chọn dữ liệu", "Ánh xạ trường", "Duyệt & lưu"].map((label, i) => (
            <li
              key={label}
              aria-current={step === i + 1 ? "step" : undefined}
              className={`flex items-center gap-2 ${step === i + 1 ? "font-semibold text-primary" : "text-muted-foreground"}`}
            >
              <span
                className={`flex size-6 items-center justify-center rounded-full text-xs ${step === i + 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {step > i + 1 ? <CheckCircle2 className="size-4" /> : i + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
      </div>
      <div
        role={pendingTransfer ? "alert" : "note"}
        className="mx-5 mt-5 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"
      >
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium">
            {pendingTransfer
              ? "Chưa xác nhận chuyển xong tác vụ đến máy chủ — hãy giữ trang mở."
              : "Upload ảnh cần giữ trang mở"}
          </p>
          <p className="mt-1 text-muted-foreground">
            Khi đang chuẩn bị hoặc upload ảnh, đừng tải lại trang, đóng tab trình duyệt hoặc đóng tab import. Tiến trình
            upload sẽ tạm dừng khi đóng trang. Phiên đã lưu cho phép chọn lại gói ảnh và tiếp tục, không tải lại ảnh đã
            xong. Sau khi hiện “Đã gửi đến máy chủ”, bạn có thể đóng trang và xem lại tiến trình nhập dữ liệu khi quay
            lại.
          </p>
        </div>
      </div>
      {!context && (
        <div className="mx-5 mt-5 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          Chọn mùa và patch phía trên để bắt đầu. Dữ liệu sẽ được ghi nhận từ mốc đã chọn.
        </div>
      )}
      {context && (
        <div className="mx-5 mt-5 rounded-lg bg-primary/5 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Nhập vào </span>
          <strong>
            {context.seasonName} / {context.patchCode}
          </strong>
          <span className="ml-2 text-muted-foreground">· {locale}</span>
        </div>
      )}
      {capture && (
        <section
          className="mx-5 mt-5 space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4"
          aria-label="Bộ dữ liệu ảnh chụp"
        >
          <h3 className="font-medium">Đã nhận diện {capture.rows.length} tướng từ bộ ảnh chụp</h3>
          {capture.warnings.map((warning) => (
            <p key={warning} className="text-sm leading-6 text-muted-foreground">
              {warning}
            </p>
          ))}
          <p className="text-sm">
            {capture.reviewCount} tướng có nội dung cần đối chiếu thêm. Các ghi chú nguồn sẽ đi cùng dữ liệu kỹ năng.
          </p>
          {capture.rows
            .filter((row) => ["flowborn", "flowborn-2"].includes(String(row.__sourceCode)))
            .map((row) => (
              <label key={String(row.__sourceCode)} className="grid gap-2 text-sm sm:max-w-md">
                Xác nhận danh tính: {String(row.__sourceCode)}
                <select
                  className={control}
                  value={String(row.code)}
                  disabled={busy || artworkMerged}
                  onChange={(event) => {
                    const next = capture.rows.map((item) =>
                      item.__sourceCode === row.__sourceCode ? { ...item, code: event.target.value } : item,
                    )
                    setCapture({ ...capture, rows: next })
                    adoptRows(next)
                    setPolicies(policies)
                  }}
                >
                  <option value="">Chọn dạng Flowborn phù hợp</option>
                  <option value="flowborn-ad">Flowborn · Xạ thủ</option>
                  <option value="flowborn-mid">Flowborn · Pháp sư</option>
                </select>
                <span className="text-xs text-muted-foreground">
                  {((row.skills as Record<string, unknown>[]) ?? []).map((skill) => String(skill.name)).join(" · ")}
                </span>
              </label>
            ))}
          {capture.rows.some((row) => !row.code) && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Xác nhận hai bản Flowborn trước khi nhập để tránh tạo tướng trùng hoặc gắn nhầm dạng.
            </p>
          )}
          <Button
            variant="outline"
            disabled={busy || artworkMerged || capture.rows.some((row) => !row.code)}
            onClick={async () => {
              setBusy(true)
              setError("")
              try {
                const response = await fetch("/__resources/data/heroes.json", { credentials: "omit" })
                if (!response.ok || !response.headers.get("content-type")?.includes("application/json"))
                  throw new Error("Không đọc được tài nguyên trên máy chủ này. Hãy chọn thư mục hoặc ZIP chứa ảnh.")
                const resource = (await response.json()) as { heroes: Record<string, unknown>[] }
                adoptRows(mergeResourceArtwork(capture.rows, resource.heroes))
                setPolicies({ skills: "OVERWRITE", skins: "OVERWRITE" })
                setArtworkMerged(true)
              } catch (failure) {
                setError(errorMessage(failure))
              } finally {
                setBusy(false)
              }
            }}
          >
            <FolderOpen className="mr-2 size-4" />
            {artworkMerged
              ? "Đã ghép ảnh tài nguyên vào ánh xạ"
              : "Ghép ảnh tướng, kỹ năng và trang phục từ tài nguyên"}
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">
            Ghép theo mã tướng và vị trí kỹ năng. Chỉ những trường ảnh giữ trong ánh xạ mới được upload; dữ liệu và ảnh
            sẵn có vẫn tuân theo lựa chọn ghi đè hoặc bỏ qua.
          </p>
        </section>
      )}
      {context && mode === "BASELINE" && (
        <BaselineMigration
          context={context}
          request={request}
          onBusyChange={setBusy}
          onMoved={() => {
            setEntries([])
            if (rows.length) setStep(2)
          }}
        />
      )}
      <fieldset disabled={busy || !context || awaitingRetry} className="space-y-5 p-5">
        {step === 1 && (
          <div
            className={`space-y-3 rounded-lg border-2 border-dashed p-4 transition-colors ${dragging ? "border-primary bg-primary/10" : "border-border"}`}
            onDragEnter={(event) => {
              event.preventDefault()
              if (!busy && context && !awaitingRetry) {
                dragDepth.current++
                setDragging(true)
              }
            }}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = busy || !context || awaitingRetry ? "none" : "copy"
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              if (--dragDepth.current <= 0) {
                dragDepth.current = 0
                setDragging(false)
              }
            }}
            onDrop={(event) => {
              event.preventDefault()
              dragDepth.current = 0
              setDragging(false)
              if (!busy && context && !awaitingRetry) void dropSource(readImportDrop(event.dataTransfer))
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">Nguồn dữ liệu</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {dragging ? "Thả để đọc dữ liệu" : "Kéo thả JSON/CSV, ZIP hoặc thư mục vào đây"}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground" title={sourceName || fileName}>
                  {sourceName || fileName || "Chọn dữ liệu để bắt đầu"}
                  {files.size ? ` · ${files.size} file` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => dataInput.current?.click()}>
                  <FileJson className="size-4" />
                  JSON / CSV
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => folderInput.current?.click()}>
                  <FolderOpen className="size-4" />
                  Thư mục
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => zipInput.current?.click()}>
                  <FileArchive className="size-4" />
                  ZIP
                </Button>
              </div>
            </div>
            <input
              ref={dataInput}
              type="file"
              accept=".json,.csv"
              className="hidden"
              aria-label="Chọn JSON hoặc CSV"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void load(file)
                e.target.value = ""
              }}
            />
            <input
              ref={folderInput}
              type="file"
              multiple
              {...({ webkitdirectory: "" } as Record<string, string>)}
              className="hidden"
              aria-label="Chọn thư mục"
              onChange={(e) => {
                chooseFolder(Array.from(e.target.files ?? []))
                e.target.value = ""
              }}
            />
            <input
              ref={zipInput}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              aria-label="Chọn ZIP"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void chooseZip(file)
                e.target.value = ""
              }}
            />
            {!!files.size && (
              <>
                <label className="block text-sm">
                  File dữ liệu trong gói
                  <select
                    className={control}
                    value={dataPath}
                    onChange={(event) => {
                      const file = files.get(event.target.value)
                      if (file) void load(file, event.target.value)
                    }}
                  >
                    <option value="">Chọn JSON hoặc CSV ({files.size} file trong thư mục)</option>
                    {[...files.keys()]
                      .filter((path) => /\.(json|csv)$/i.test(path))
                      .map((path) => (
                        <option key={path}>{path}</option>
                      ))}
                  </select>
                </label>
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">
                    Đường dẫn ảnh · {base || "Gốc gói"}
                  </summary>
                  <label className="mt-3 block text-sm">
                    Thư mục gốc của đường dẫn ảnh
                    <select
                      className={control}
                      value={base}
                      onChange={(event) => {
                        setBase(event.target.value)
                        setEntries([])
                      }}
                    >
                      <option value="">Gốc thư mục / ZIP đã chọn</option>
                      {[
                        ...new Set(
                          [...files.keys()].flatMap((path) => {
                            const parts = path.split("/").slice(0, -1)
                            return parts.map((_, i) => parts.slice(0, i + 1).join("/"))
                          }),
                        ),
                      ]
                        .sort()
                        .map((path) => (
                          <option key={path}>{path}</option>
                        ))}
                    </select>
                  </label>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Mặc định tính từ thư mục chứa JSON/CSV. Với đường dẫn assets/…, chọn gốc bộ tài nguyên.
                  </p>
                </details>
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Chỉ upload ảnh đã ánh xạ. ZIP tối đa 256 MB; bộ lớn hơn chọn thư mục.
            </p>
          </div>
        )}
        {!!Object.keys(arrayChoices).length && (
          <label className="block text-sm">
            Mảng dữ liệu trong JSON
            <select
              className={control}
              value=""
              onChange={(event) => {
                try {
                  adoptRows(arrayChoices[event.target.value])
                } catch (cause) {
                  setError(errorMessage(cause))
                }
              }}
            >
              <option value="">Chọn mảng chứa tướng</option>
              {Object.entries(arrayChoices).map(([key, value]) => (
                <option key={key} value={key}>
                  {key} ({value.length} bản ghi)
                </option>
              ))}
            </select>
          </label>
        )}
        {step === 1 && (
          <>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))" }}
              role="radiogroup"
              aria-label="Mục đích nhập dữ liệu"
            >
              {modes.map((m) => (
                <label
                  key={m.key}
                  className={`flex cursor-pointer flex-col gap-3 rounded-xl border p-4 transition-colors ${mode === m.key ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/40"}`}
                >
                  <span className="flex items-center justify-between">
                    <m.icon className={`size-5 ${mode === m.key ? "text-primary" : "text-muted-foreground"}`} />
                    <input
                      type="radio"
                      name="import-mode"
                      value={m.key}
                      checked={mode === m.key}
                      onChange={() => {
                        setMode(m.key)
                        setEntries([])
                      }}
                    />
                  </span>
                  <span className="text-sm font-semibold">{m.title}</span>
                  <span className="text-sm leading-relaxed text-muted-foreground">{m.description}</span>
                </label>
              ))}
            </div>
            {!!rows.length && (
              <Button type="button" onClick={() => setStep(2)}>
                Tiếp tục với {fileName}
                <ArrowRight className="ml-2 size-4" />
              </Button>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-medium">{fileName}</h3>
                <p className="text-sm text-muted-foreground">
                  {rows.length} bản ghi · {modes.find((m) => m.key === mode)?.title}
                </p>
              </div>
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                Đổi file / loại nhập
              </Button>
            </div>
            <label className="grid gap-2 rounded-lg bg-muted/40 p-4 text-sm sm:grid-cols-2 sm:items-center">
              <span>
                <strong>Cột nhận diện tướng</strong>
                <span className="mt-1 block text-muted-foreground">
                  Dùng mã ổn định như airi. Không tạo lại ID khi cập nhật.
                </span>
              </span>
              <select
                className={control}
                value={idColumn}
                onChange={(e) => {
                  setIdColumn(e.target.value)
                  setEntries([])
                }}
              >
                <option value="">Chọn cột mã tướng</option>
                {columns.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <div className="hidden grid-cols-3 gap-4 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
              <span>Trường dữ liệu</span>
              <span>Cột trong file</span>
              <span>Khi đã có giá trị</span>
            </div>
            <div className="divide-y rounded-lg border">
              {fields.data?.map((field) => (
                <div key={field.key} className="grid gap-3 p-3 sm:grid-cols-3 sm:items-start">
                  <div className="text-sm">
                    <span className="font-medium">{field.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {field.type === "image"
                        ? "Đường dẫn trong thư mục / HTTPS / UUID asset"
                        : field.type === "json"
                          ? "Ghi đè dữ liệu mục này; kiểm tra bản xem trước"
                          : "Ô trống sẽ giữ dữ liệu hiện có"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <select
                      aria-label={`Cột nguồn cho ${field.label}`}
                      className={control}
                      value={mapping[field.key] ?? ""}
                      onChange={(e) => {
                        setMapping({ ...mapping, [field.key]: e.target.value })
                        if (field.key === "skills" || field.key === "skins")
                          setRelations({
                            ...relations,
                            [field.key]: defaultRelationMapping(
                              rows.find(
                                (row) =>
                                  Array.isArray(row[e.target.value]) && (row[e.target.value] as unknown[]).length,
                              )?.[e.target.value],
                              field.key,
                            ),
                          })
                        setEntries([])
                      }}
                    >
                      <option value="">Không nhập trường này</option>
                      {columns.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    {mapping[field.key] && (
                      <p
                        className="mt-1 truncate text-xs text-muted-foreground"
                        title={sampleValue(rows[0]?.[mapping[field.key]])}
                      >
                        Ví dụ: {sampleValue(rows[0]?.[mapping[field.key]])}
                      </p>
                    )}
                  </div>
                  <select
                    aria-label={`Xử lý ${field.label}`}
                    className={control}
                    value={policies[field.key] ?? "FILL_EMPTY"}
                    onChange={(e) => {
                      setPolicies({ ...policies, [field.key]: e.target.value as Policy })
                      setEntries([])
                    }}
                  >
                    <option value="FILL_EMPTY">Chỉ bổ sung chỗ trống</option>
                    <option value="OVERWRITE">Ghi đè giá trị</option>
                    <option value="SKIP">Bỏ qua</option>
                  </select>
                </div>
              ))}
            </div>
            {(["skills", "skins"] as const)
              .filter((section) => mapping[section] && policies[section] !== "SKIP")
              .map((section) => (
                <RelationMappingFields
                  key={section}
                  section={section}
                  sample={
                    rows.find(
                      (row) => Array.isArray(row[mapping[section]]) && (row[mapping[section]] as unknown[]).length,
                    )?.[mapping[section]] ?? rows[0]?.[mapping[section]]
                  }
                  value={relations[section]}
                  fields={relationFields.data?.[section] ?? []}
                  onChange={(value) => {
                    setRelations({ ...relations, [section]: value })
                    setEntries([])
                  }}
                />
              ))}
            {relationFields.error && (
              <p role="alert" className="text-sm text-destructive">
                Không tải được trường ánh xạ kỹ năng/trang phục. Hãy cập nhật backend.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Xem trước chưa ghi dữ liệu và chưa tải ảnh.</p>
              <Button
                type="button"
                disabled={
                  !idColumn ||
                  !context ||
                  !fields.data ||
                  !Object.values(mapping).some(Boolean) ||
                  !!capture?.rows.some((row) => !row.code)
                }
                onClick={() => void preview()}
              >
                Kiểm tra {rows.length} bản ghi
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Duyệt kết quả trước khi lưu</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {fileName} · {modes.find((m) => m.key === mode)?.title}. Chỉ lưu nháp, chưa xuất bản.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEntries([])
                  setStep(2)
                }}
              >
                Sửa ánh xạ
              </Button>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Lọc kết quả">
              {[["ALL", "Tất cả"], ...Object.entries(IMPORT_STATUS), ["ERROR", "Lỗi"]].map(([key, label]) => {
                const count = entries.filter(
                  (e) => key === "ALL" || (key === "ERROR" ? !!e.error : e.plan?.classification === key),
                ).length
                return (
                  count > 0 && (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant={filter === key ? "secondary" : "ghost"}
                      aria-pressed={filter === key}
                      onClick={() => setFilter(key)}
                    >
                      {label} <span className="ml-1 text-muted-foreground">{count}</span>
                    </Button>
                  )
                )
              })}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={entries.some(eligible) && entries.filter(eligible).every((e) => e.selected)}
                onChange={(e) =>
                  setEntries(entries.map((item) => ({ ...item, selected: eligible(item) && e.target.checked })))
                }
              />
              Chọn tất cả bản ghi có thể nhập
            </label>
            <div className="space-y-3">
              {shown.map((entry) => {
                const i = entries.indexOf(entry)
                const changedFields =
                  fields.data?.filter(
                    (f) =>
                      entry.plan &&
                      (JSON.stringify(entry.plan.before[f.key]) !== JSON.stringify(entry.plan.after[f.key]) ||
                        (entry.imageUrls?.[f.key] &&
                          (entry.input.policies[f.key] === "OVERWRITE" || !entry.plan.before[f.key]))),
                  ) ?? []
                return (
                  <article
                    key={i}
                    className={`overflow-hidden rounded-lg border ${entry.error ? "border-destructive/40" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/20 px-4 py-3">
                      <label className="flex items-center gap-3 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={entry.selected}
                          disabled={!eligible(entry)}
                          onChange={(e) =>
                            setEntries(
                              entries.map((item, j) => (j === i ? { ...item, selected: e.target.checked } : item)),
                            )
                          }
                        />
                        {entry.input.code || `Dòng ${i + 1}`}
                      </label>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs ${entry.result ? "border-emerald-500/30 text-emerald-600" : "text-muted-foreground"}`}
                      >
                        {entry.result ||
                          (entry.error ? "Cần xử lý" : entry.plan && IMPORT_STATUS[entry.plan.classification])}
                      </span>
                    </div>
                    {entry.error && (
                      <p role="alert" className="px-4 py-3 text-sm text-destructive">
                        {entry.error}
                      </p>
                    )}
                    {entry.plan?.warnings.map((w) => (
                      <p key={w} className="flex gap-2 px-4 py-2 text-xs leading-relaxed text-muted-foreground">
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                        {w}
                      </p>
                    ))}
                    {!!entry.relatedImages?.length && (
                      <details
                        className="border-t px-4 py-3 text-sm"
                        onToggle={(event) => {
                          const open = event.currentTarget.open
                          setExpandedImages((current) => {
                            const next = new Set(current)
                            if (open) next.add(i)
                            else next.delete(i)
                            return next
                          })
                        }}
                      >
                        <summary className="cursor-pointer">
                          Sẽ upload {entry.relatedImages.length} ảnh liên quan
                        </summary>
                        {expandedImages.has(i) && (
                          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                            {entry.relatedImages.map((image) => (
                              <li key={`${image.section}-${image.index}-${image.field}`} className="break-all">
                                {image.section} · {image.field}: {image.source}
                              </li>
                            ))}
                          </ul>
                        )}
                      </details>
                    )}
                    {!!changedFields.length && (
                      <details
                        className="border-t"
                        onToggle={(event) => {
                          const open = event.currentTarget.open
                          setExpandedEntries((current) => {
                            const next = new Set(current)
                            if (open) next.add(i)
                            else next.delete(i)
                            return next
                          })
                        }}
                      >
                        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                          Xem {changedFields.length} trường khác biệt
                        </summary>
                        {expandedEntries.has(i) && (
                          <div className="divide-y">
                            {changedFields.map((f) => (
                              <div key={f.key} className="grid gap-3 px-4 py-3 text-sm sm:grid-cols-[1fr_2fr_2fr]">
                                <span className="font-medium">{f.label}</span>
                                <div className="min-w-0">
                                  <p className="mb-1 text-xs text-muted-foreground">Trước</p>
                                  <div className="max-h-64 overflow-auto rounded-md bg-muted/40 p-2">
                                    <ImportValue value={entry.plan?.before[f.key]} />
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <p className="mb-1 text-xs text-muted-foreground">Sau khi nhập</p>
                                  <div className="max-h-64 overflow-auto rounded-md bg-primary/5 p-2">
                                    <ImportValue value={entry.imageUrls?.[f.key] ?? entry.plan?.after[f.key]} />
                                  </div>
                                  {entry.imageUrls?.[f.key] && (
                                    <p className="mt-1 text-xs text-muted-foreground">Ảnh chỉ tải khi xác nhận lưu.</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </details>
                    )}
                  </article>
                )
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Đã chọn {selectedCount}/{entries.length} · {entries.filter((e) => e.result).length} đã gửi
              </p>
              <Button type="button" disabled={!selectedCount} onClick={() => void apply()}>
                Lưu {selectedCount} bản nháp
              </Button>
            </div>
          </>
        )}
      </fieldset>
      {fields.error && (
        <p role="alert" className="px-5 pb-4 text-sm text-destructive">
          Không tải được trường nhập liệu. Kiểm tra backend đã cập nhật. {errorMessage(fields.error)}
        </p>
      )}
      {busy && (
        <p role="status" aria-live="polite" className="border-t bg-primary/5 px-5 py-3 text-sm">
          {progress}…
        </p>
      )}
      {awaitingRetry && (
        <Button className="m-5" disabled={busy} onClick={() => void apply()}>
          Gửi lại cùng tác vụ
        </Button>
      )}
      {error && (
        <p role="alert" className="px-5 pb-4 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
