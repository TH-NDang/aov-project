import { NativeSelect } from "@/components/native-select"
import type { SourceDataset } from "../../model/import/hero-source-dataset"

/**
 * A file read from the screenshot captures: how many heroes it holds, what to check, and which Flowborn form each of
 * its two Flowborn rows is, since the captures cannot tell them apart.
 */
export function ImportCaptureDataset({
  capture,
  disabled,
  onConfirmIdentity,
}: {
  capture: SourceDataset
  disabled: boolean
  onConfirmIdentity: (sourceCode: unknown, code: string) => void
}) {
  return (
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
            <NativeSelect
              className="w-full"
              value={String(row.code)}
              disabled={disabled}
              onChange={(event) => onConfirmIdentity(row.__sourceCode, event.target.value)}
            >
              <option value="">Chọn dạng Flowborn phù hợp</option>
              <option value="flowborn-ad">Flowborn · Xạ thủ</option>
              <option value="flowborn-mid">Flowborn · Pháp sư</option>
            </NativeSelect>
            <span className="text-xs text-muted-foreground">
              {((row.skills as Record<string, unknown>[]) ?? []).map((skill) => String(skill.name)).join(" · ")}
            </span>
          </label>
        ))}
      {capture.rows.some((row) => !row.code) && (
        <p className="text-sm text-(--aov-warning)">
          Xác nhận hai bản Flowborn trước khi nhập để tránh tạo tướng trùng hoặc gắn nhầm dạng.
        </p>
      )}
    </section>
  )
}
