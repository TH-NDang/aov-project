import { useRef, useState } from "react"
import { FileArchive, FileJson, FolderOpen } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { NativeSelect } from "@/components/native-select"
import { dataFilePaths, imageBaseFolders } from "../../model/import/hero-import-model"
import { readImportDrop } from "../../model/import/import-drop"
import type { HeroImportState } from "./use-hero-import"

/**
 * The first step of an import: a JSON or CSV file, a folder or a ZIP, chosen or dropped. A folder or ZIP then names
 * the data file inside it and the folder its picture paths start from.
 */
export function ImportSourceStep({ importer, disabled }: { importer: HeroImportState; disabled: boolean }) {
  const folderInput = useRef<HTMLInputElement>(null)
  const zipInput = useRef<HTMLInputElement>(null)
  const dataInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const { files, base, dataPath, sourceName, fileName } = importer
  return (
    <div
      className={`space-y-3 rounded-lg border-2 border-dashed p-4 transition-colors ${dragging ? "border-primary bg-primary/10" : "border-border"}`}
      onDragEnter={(event) => {
        event.preventDefault()
        if (!disabled) {
          dragDepth.current++
          setDragging(true)
        }
      }}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = disabled ? "none" : "copy"
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
        if (!disabled) void importer.dropSource(readImportDrop(event.dataTransfer))
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
          if (file) void importer.load(file)
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
          importer.chooseFolder(Array.from(e.target.files ?? []))
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
          if (file) void importer.chooseZip(file)
          e.target.value = ""
        }}
      />
      {!!files.size && (
        <>
          <label className="block text-sm">
            Tệp dữ liệu trong gói
            <NativeSelect
              className="w-full"
              value={dataPath}
              onChange={(event) => {
                const file = files.get(event.target.value)
                if (file) void importer.load(file, event.target.value)
              }}
            >
              <option value="">Chọn JSON hoặc CSV ({files.size} tệp trong thư mục)</option>
              {dataFilePaths(files.keys()).map((path) => (
                <option key={path}>{path}</option>
              ))}
            </NativeSelect>
          </label>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Đường dẫn ảnh · {base || "Gốc gói"}</summary>
            <label className="mt-3 block text-sm">
              Thư mục gốc của đường dẫn ảnh
              <NativeSelect
                className="w-full"
                value={base}
                onChange={(event) => importer.chooseBase(event.target.value)}
              >
                <option value="">Gốc thư mục / ZIP đã chọn</option>
                {imageBaseFolders(files.keys()).map((path) => (
                  <option key={path}>{path}</option>
                ))}
              </NativeSelect>
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              Mặc định tính từ thư mục chứa JSON/CSV. Với đường dẫn assets/…, chọn gốc bộ tài nguyên.
            </p>
          </details>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Chỉ tải lên ảnh đã ánh xạ. ZIP tối đa 256 MB; bộ lớn hơn chọn thư mục.
      </p>
    </div>
  )
}
