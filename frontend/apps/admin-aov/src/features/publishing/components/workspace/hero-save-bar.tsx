import { Save, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import type { HeroWorkspaceState } from "./use-hero-workspace"

/** The bar under the page while a section is edited: its change note, and saving or leaving that section. */
export function HeroSaveBar({ workspace }: { workspace: HeroWorkspaceState }) {
  const { sectionFormId, sectionDirty, note, busy } = workspace
  return (
    <fieldset
      aria-label="Lưu thay đổi"
      disabled={workspace.editorDisabled}
      className="m-0 min-w-0 shrink-0 border-t bg-background pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-2 px-4 py-2 @min-[650px]:grid-cols-[minmax(0,1fr)_auto] @min-[650px]:items-center md:px-6">
        <label className="min-w-0">
          <span className="sr-only">Ghi chú thay đổi</span>
          <Input
            form={sectionFormId}
            className="w-full disabled:bg-muted/40 disabled:text-muted-foreground"
            placeholder="Ghi chú thay đổi (tùy chọn)"
            value={note}
            disabled={!sectionDirty}
            onChange={(event) => workspace.setNote(event.target.value)}
          />
        </label>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <span className="type-meta mr-auto truncate @min-[650px]:sr-only">
            {sectionDirty ? "Có thay đổi chưa lưu" : "Chưa có thay đổi"}
          </span>
          <Button type="button" variant="outline" onClick={workspace.cancelSection}>
            <X className="size-4" />
            <span>
              Hủy<span className="sr-only"> chỉnh sửa phần này</span>
            </span>
          </Button>
          <Button type="submit" form={sectionFormId} disabled={!sectionDirty}>
            <Save className="size-4" />
            {busy ? "Đang lưu…" : "Lưu phần này"}
          </Button>
        </div>
      </div>
    </fieldset>
  )
}
