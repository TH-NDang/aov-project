import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { errorMessage } from "@/lib/api/errors"
import { type Request, publishingKeys } from "@/lib/api/publishing-api"
import { parseCsv, recordArrays } from "../../../storage/storage-model"
import { captureDataset, type SourceDataset } from "../../model/import/hero-source-dataset"
import type {
  ImportActivity,
  ImportField as Field,
  ImportPolicy as Policy,
  HeroImportInput as Input,
} from "../../model/import/hero-import-types"
import {
  defaultFieldMapping,
  defaultIdColumn,
  droppedSource,
  importColumns,
} from "../../model/import/hero-import-model"
import { readImportZip } from "../../model/import/import-archive"
import { detectImportImageBase, indexImportFiles } from "../../model/import/import-files"
import {
  defaultRelationMapping,
  type Relation,
  type RelationField,
  type RelationMapping,
} from "../../model/import/import-relations"
import type { ImportContext } from "./import-context"
import { useImportReview } from "./use-import-review"

/**
 * The state of the import wizard: the source the editor picked (a file, a folder or a ZIP), the rows read from it and
 * how their columns map to hero fields. Checking and saving the rows is `review`.
 */
export function useHeroImport({
  context,
  locale,
  onBusyChange,
  onActivityChange,
  request,
}: {
  context: ImportContext | null
  locale: string
  onBusyChange: (busy: boolean) => void
  onActivityChange?: (activity: ImportActivity) => void
  request: Request
}) {
  const fields = useQuery({
    queryKey: publishingKeys.importFields,
    queryFn: () => request<Field[]>("/admin/heroes/import/fields"),
  })
  const relationFields = useQuery({
    queryKey: publishingKeys.importRelationFields,
    queryFn: () => request<Record<Relation, RelationField[]>>("/admin/heroes/import/relation-fields"),
  })
  const [files, setFiles] = useState(new Map<string, File>())
  const [base, setBase] = useState("")
  const [dataPath, setDataPath] = useState("")
  const [sourceName, setSourceName] = useState("")
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
  const [progress, setProgress] = useState("")
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [idColumn, setIdColumn] = useState("")
  const [policies, setPolicies] = useState<Record<string, Policy>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const review = useImportReview({
    request,
    context,
    locale,
    files,
    base,
    fileName,
    rows,
    idColumn,
    mode,
    fields: fields.data,
    relationFields: relationFields.data,
    mapping,
    relations,
    policies,
    setBusy,
    setError,
    setProgress,
    setActivity,
    setStep,
  })
  useEffect(() => {
    onBusyChange(busy)
    return () => onBusyChange(false)
  }, [busy, onBusyChange])

  function adoptRows(next: Record<string, unknown>[]) {
    if (!next?.length || next.length > 200) throw new Error("Mỗi lần nhập từ 1 đến 200 tướng.")
    setRows(next)
    setError("")
    setActivity({ status: "review", description: "Chờ ánh xạ cột", completed: 1, total: 1 })
    const columns = importColumns(next)
    setMapping(defaultFieldMapping(fields.data ?? [], columns))
    setIdColumn(defaultIdColumn(columns))
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
    setFiles(index)
    setSourceName(label)
    setDataPath("")
    setFileName("")
    setBase("")
    setRows([])
    review.setEntries([])
    setArrayChoices({})
    setStep(1)
    setError("")
    review.forgetSubmission()
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
      const source = droppedSource(dropped)
      if (source.kind === "zip") await chooseZip(source.file)
      else if (source.kind === "data") await load(source.file)
      else adoptFiles(dropped, "Dữ liệu kéo thả")
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
    setProgress("Đang đọc tệp")
    setActivity({ status: "running", description: "Đang đọc tệp", completed: 0, total: 1 })
    setError("")
    review.setEntries([])
    setArrayChoices({})
    setRows([])
    setStep(1)
    setDataPath(path ?? "")
    setCapture(null)
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Tệp tối đa 5 MB.")
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
      if (!Object.keys(choices).length) throw new Error("Tệp không có mảng bản ghi để nhập.")
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
      setActivity({ status: "error", description: "Không đọc được tệp", completed: 0, total: 1 })
    } finally {
      setBusy(false)
    }
  }

  /** The editor picks the array of heroes in a JSON file that holds several. */
  function chooseArray(key: string) {
    try {
      adoptRows(arrayChoices[key])
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  /** Another purpose or another root for picture paths makes the plans checked so far stale. */
  function chooseMode(next: Input["mode"]) {
    setMode(next)
    review.setEntries([])
  }

  function chooseBase(next: string) {
    setBase(next)
    review.setEntries([])
  }

  /** A capture that cannot tell two forms of a hero apart asks which one each of its rows is. */
  function confirmIdentity(sourceCode: unknown, code: string) {
    if (!capture) return
    const next = capture.rows.map((item) => (item.__sourceCode === sourceCode ? { ...item, code } : item))
    setCapture({ ...capture, rows: next })
    adoptRows(next)
    setPolicies(policies)
  }

  return {
    fields,
    relationFields,
    files,
    base,
    dataPath,
    sourceName,
    arrayChoices,
    relations,
    setRelations,
    rows,
    columns: importColumns(rows),
    mode,
    step,
    setStep,
    fileName,
    capture,
    progress,
    mapping,
    setMapping,
    idColumn,
    setIdColumn,
    policies,
    setPolicies,
    busy,
    setBusy,
    error,
    review,
    chooseZip,
    dropSource,
    chooseFolder,
    load,
    chooseArray,
    chooseMode,
    chooseBase,
    confirmIdentity,
  }
}

export type HeroImportState = ReturnType<typeof useHeroImport>
