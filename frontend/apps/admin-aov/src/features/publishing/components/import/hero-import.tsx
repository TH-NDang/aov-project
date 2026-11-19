import { AlertCircle, ArrowRight, CheckCircle2, Upload } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { backendRequest } from "@/app/auth/session"
import { NativeSelect } from "@/components/native-select"
import { errorMessage } from "@/lib/api/errors"
import type { Request } from "@/lib/api/publishing-api"
import type { ImportActivity } from "../../model/import/hero-import-types"
import { BaselineMigration } from "./baseline-migration"
import { ImportCaptureDataset } from "./import-capture-dataset"
import type { ImportContext } from "./import-context"
import { ImportMappingStep } from "./import-mapping-step"
import { ImportModeChoice, importModeTitle } from "./import-mode-choice"
import { ImportReviewStep } from "./import-review-step"
import { ImportSourceStep } from "./import-source-step"
import { useHeroImport } from "./use-hero-import"

const steps = ["Chọn dữ liệu", "Ánh xạ trường", "Duyệt & lưu"]

/**
 * The import wizard of heroes for one season and patch: choose the data, map its columns to hero fields, then review
 * what the server would change and save the chosen rows as drafts. Nothing is published.
 */
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
  const importer = useHeroImport({ context, locale, onBusyChange, onActivityChange, request })
  const { review, step, setStep, rows, mode, fileName, capture, busy, arrayChoices, fields, mapping, idColumn } =
    importer
  const { pendingTransfer, awaitingRetry } = review
  return (
    <section className="overflow-hidden admin-section" aria-label="Nhập tướng">
      <div className="border-b bg-muted/30 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 type-section-title">
            <Upload className="size-4" /> Nhập dữ liệu tướng
          </h2>
          <span className="text-xs text-muted-foreground">JSON / CSV · Tối đa 5 MB / 200 tướng</span>
        </div>
        <ol className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Tiến trình nhập">
          {steps.map((label, i) => (
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
        className="mx-5 mt-5 flex items-start gap-2 rounded-lg border border-(--aov-warning)/30 bg-(--aov-warning-soft) p-3 text-sm"
      >
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium">
            {pendingTransfer
              ? "Chưa xác nhận chuyển xong tác vụ đến máy chủ — hãy giữ trang mở."
              : "Tải ảnh lên cần giữ trang mở"}
          </p>
          <p className="mt-1 text-muted-foreground">
            Khi đang chuẩn bị hoặc tải ảnh lên, đừng tải lại trang, đóng tab trình duyệt hoặc đóng tab nhập. Tiến trình
            tải lên sẽ tạm dừng khi đóng trang. Phiên đã lưu cho phép chọn lại gói ảnh và tiếp tục, không tải lại ảnh đã
            xong. Sau khi hiện “Đã gửi đến máy chủ”, bạn có thể đóng trang và xem lại tiến trình nhập dữ liệu khi quay
            lại.
          </p>
        </div>
      </div>
      {!context && (
        <div className="mx-5 mt-5 flex items-start gap-2 rounded-lg border border-(--aov-warning)/30 bg-(--aov-warning-soft) p-3 text-sm">
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
        <ImportCaptureDataset capture={capture} disabled={busy} onConfirmIdentity={importer.confirmIdentity} />
      )}
      {context && mode === "BASELINE" && (
        <BaselineMigration
          context={context}
          request={request}
          onBusyChange={importer.setBusy}
          onMoved={() => {
            review.setEntries([])
            if (rows.length) setStep(2)
          }}
        />
      )}
      <fieldset disabled={busy || !context || awaitingRetry} className="space-y-5 p-5">
        {step === 1 && <ImportSourceStep importer={importer} disabled={busy || !context || awaitingRetry} />}
        {!!Object.keys(arrayChoices).length && (
          <label className="block text-sm">
            Mảng dữ liệu trong JSON
            <NativeSelect className="w-full" value="" onChange={(event) => importer.chooseArray(event.target.value)}>
              <option value="">Chọn mảng chứa tướng</option>
              {Object.entries(arrayChoices).map(([key, value]) => (
                <option key={key} value={key}>
                  {key} ({value.length} bản ghi)
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        {step === 1 && (
          <>
            <ImportModeChoice mode={mode} onChange={importer.chooseMode} />
            {!!rows.length && (
              <Button type="button" onClick={() => setStep(2)}>
                Tiếp tục với {fileName}
                <ArrowRight className="ml-2 size-4" />
              </Button>
            )}
          </>
        )}
        {step === 2 && (
          <ImportMappingStep
            fileName={fileName}
            modeTitle={importModeTitle(mode)}
            rows={rows}
            columns={importer.columns}
            idColumn={idColumn}
            setIdColumn={importer.setIdColumn}
            fields={fields.data}
            relationFields={importer.relationFields.data}
            relationFieldsFailed={!!importer.relationFields.error}
            mapping={mapping}
            setMapping={importer.setMapping}
            policies={importer.policies}
            setPolicies={importer.setPolicies}
            relations={importer.relations}
            setRelations={importer.setRelations}
            onChange={() => review.setEntries([])}
            onBack={() => setStep(1)}
            previewBlocked={
              !idColumn ||
              !context ||
              !fields.data ||
              !Object.values(mapping).some(Boolean) ||
              !!capture?.rows.some((row) => !row.code)
            }
            onPreview={() => void review.preview()}
          />
        )}
        {step === 3 && (
          <ImportReviewStep
            review={review}
            fields={fields.data}
            fileName={fileName}
            modeTitle={importModeTitle(mode)}
            onEditMapping={() => {
              review.setEntries([])
              setStep(2)
            }}
          />
        )}
      </fieldset>
      {fields.error && (
        <p role="alert" className="px-5 pb-4 text-sm text-destructive">
          Không tải được trường nhập liệu. Kiểm tra máy chủ đã cập nhật. {errorMessage(fields.error)}
        </p>
      )}
      {busy && (
        <p role="status" aria-live="polite" className="border-t bg-primary/5 px-5 py-3 text-sm">
          {importer.progress}…
        </p>
      )}
      {awaitingRetry && (
        <Button className="m-5" disabled={busy} onClick={() => void review.apply()}>
          Gửi lại cùng tác vụ
        </Button>
      )}
      {importer.error && (
        <p role="alert" className="px-5 pb-4 text-sm text-destructive">
          {importer.error}
        </p>
      )}
    </section>
  )
}
