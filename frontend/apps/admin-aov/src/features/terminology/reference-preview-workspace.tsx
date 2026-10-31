import { memo, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react"
import { Check, Columns2, Eraser, Eye, FlaskConical, Languages, Rows2, Undo2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { EntityRichText } from "@aov/ui/components/entity-rich-text"
import { EntityRichTextEditor, type EntityRichTextEditorProps } from "@aov/ui/components/entity-rich-text-editor"
import { cn } from "@aov/ui/lib/utils"
import { languageOptions } from "../users/profile-preference-picker"
import { PreviewDivider } from "./preview-divider"
import { usePreviewViewport } from "./use-preview-viewport"

const PreviewContent = memo(EntityRichText)
const example =
  "Gây <b>sát thương phép</b> và làm chậm mục tiêu. Nhận <color=#16a34a>lá chắn</color> khi sử dụng chiêu."

type Props = Omit<EntityRichTextEditorProps, "label" | "renderPreview" | "hideLabel" | "compact" | "inputClassName"> & {
  onLocaleChange: (locale: string) => void
  context: "admin" | "wiki"
  onContextChange: (context: "admin" | "wiki") => void
}

export function ReferencePreviewWorkspace({ onLocaleChange, context, onContextChange, ...editorProps }: Props) {
  const { value, onChange, entities, locale, fallbackLocale, autoRecognize, resolveIcon } = editorProps
  const [layout, setLayout] = useState<"split" | "stacked">("split")
  const [cleared, setCleared] = useState<string | null>(null)
  const [ratio, setRatio] = useState(60)
  const [keyboardRatio, setKeyboardRatio] = useState(65)
  const viewport = usePreviewViewport()
  const editorId = useId()
  const previewScroll = useRef<HTMLDivElement>(null)
  const splitRatio = viewport.keyboard ? keyboardRatio : ratio
  const output = useDeferredValue(useMemo(() => ({ text: value, entities }), [value, entities]))
  const updating = output.text !== value
  const exampleValue = value ? `${value}\n\n${example}` : example
  const exampleFits = exampleValue.length <= Math.min(100000, editorProps.maxLength ?? 100000)

  function followInput(input: HTMLElement) {
    const result = previewScroll.current
    if (!viewport.narrow || !result) return
    const range = input.scrollHeight - input.clientHeight
    result.scrollTop = range > 0 ? (input.scrollTop / range) * (result.scrollHeight - result.clientHeight) : 0
  }

  useEffect(() => {
    if (!viewport.narrow) return
    const frame = requestAnimationFrame(() => {
      const input = viewport.container.current?.querySelector<HTMLElement>('[data-slot="entity-reference-input"]')
      const result = previewScroll.current
      if (!input || !result || document.activeElement !== input) return
      const range = input.scrollHeight - input.clientHeight
      result.scrollTop = range > 0 ? (input.scrollTop / range) * (result.scrollHeight - result.clientHeight) : 0
    })
    return () => cancelAnimationFrame(frame)
  }, [output.text, viewport.narrow, viewport.container])

  function change(value: string) {
    setCleared(null)
    onChange(value)
  }

  return (
    <section
      ref={viewport.container}
      className="min-w-0"
      aria-label="Soạn và xem trước nội dung"
      style={viewport.keyboard ? { height: viewport.height } : undefined}
    >
      <div
        data-keyboard={viewport.keyboard || undefined}
        className={cn(
          "@container/preview flex min-w-0 flex-col gap-3",
          viewport.keyboard && "fixed z-40 gap-1 bg-background p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        )}
        style={
          viewport.keyboard
            ? { top: viewport.top, left: viewport.left, width: viewport.width, height: viewport.visibleHeight }
            : viewport.narrow
              ? { height: viewport.height }
              : undefined
        }
      >
        {viewport.keyboard && (
          <div className="flex h-8 shrink-0 items-center justify-between px-1">
            <span className="text-xs font-medium text-muted-foreground">Soạn & xem trước</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => {
                if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
              }}
            >
              <Check aria-hidden className="size-3.5" /> Xong
            </Button>
          </div>
        )}
        <div
          className={cn(
            "flex shrink-0 flex-wrap items-center gap-2 rounded-xl border bg-muted/20 p-2.5",
            viewport.keyboard && "hidden",
          )}
        >
          <label className="flex h-9 min-w-0 items-center gap-2 rounded-lg border bg-background px-2.5 text-sm shadow-xs focus-within:ring-2 focus-within:ring-ring/30">
            <Languages aria-hidden className="hidden size-4 shrink-0 text-muted-foreground @xl/preview:block" />
            <select
              aria-label="Ngôn ngữ thử hiển thị"
              className="min-w-0 max-w-28 bg-background text-sm outline-none @xl/preview:max-w-44"
              value={locale}
              onChange={(event) => onLocaleChange(event.target.value)}
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {viewport.narrow ? option.label.split(" (")[0] : option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground @xl/preview:inline">Mở liên kết trong</span>
            <div role="group" aria-label="Đích mở tham chiếu" className="flex rounded-lg border bg-background p-0.5">
              {(["wiki", "admin"] as const).map((target) => (
                <Button
                  key={target}
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-pressed={context === target}
                  className={cn(
                    "h-7 rounded-md px-2.5 text-xs",
                    context === target ? "bg-muted font-semibold text-foreground" : "text-muted-foreground",
                  )}
                  onClick={() => onContextChange(target)}
                >
                  {target === "wiki" ? "Wiki" : "Admin"}
                </Button>
              ))}
            </div>
          </div>
          <div
            role="group"
            aria-label="Bố cục soạn và xem trước"
            className="ml-auto hidden items-center gap-0.5 rounded-lg border bg-background p-0.5 @xl/preview:flex"
          >
            {(
              [
                ["split", Columns2, "Hai cột"],
                ["stacked", Rows2, "Xếp dọc"],
              ] as const
            ).map(([key, Icon, label]) => (
              <Button
                key={key}
                type="button"
                variant="ghost"
                size="icon"
                aria-label={label}
                title={label}
                aria-pressed={layout === key}
                className={cn(
                  "size-7 rounded-md",
                  layout === key ? "bg-muted text-foreground" : "text-muted-foreground",
                )}
                onClick={() => setLayout(key)}
              >
                <Icon aria-hidden className="size-3.5" />
              </Button>
            ))}
          </div>
        </div>
        <div
          className={cn(
            "grid min-h-0 min-w-0 items-stretch",
            viewport.narrow ? "flex-1" : "gap-3",
            !viewport.narrow && layout === "split" && "@xl/preview:grid-cols-2",
          )}
          style={
            viewport.narrow
              ? { gridTemplateRows: `minmax(0, ${splitRatio}fr) 28px minmax(0, ${100 - splitRatio}fr)` }
              : undefined
          }
        >
          <section
            id={editorId}
            aria-label="Soạn nội dung thử"
            className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card"
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-muted/15 px-3 py-1 @xl/preview:min-h-12 @xl/preview:py-2">
              <h2 className="text-base font-bold">Soạn nội dung thử</h2>
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 px-2 text-xs"
                  title={value ? "Chèn ví dụ vào cuối nội dung" : "Dùng nội dung mẫu"}
                  disabled={!exampleFits || editorProps.disabled}
                  onClick={() => change(exampleValue)}
                >
                  <FlaskConical aria-hidden className="size-3.5" />
                  Ví dụ
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground"
                  aria-label="Xóa nội dung thử"
                  title="Xóa nội dung thử"
                  disabled={!value}
                  onClick={() => {
                    setCleared(value)
                    onChange("")
                  }}
                >
                  <Eraser aria-hidden className="size-3.5" />
                </Button>
              </div>
            </div>
            <div
              className="min-h-0 min-w-0 flex-1 p-2 @xl/preview:p-3"
              onScrollCapture={(event) => {
                if (event.target instanceof HTMLElement && event.target.dataset.slot === "entity-reference-input")
                  followInput(event.target)
              }}
            >
              <EntityRichTextEditor
                {...editorProps}
                label="Nội dung thử"
                onChange={change}
                renderPreview={false}
                hideLabel
                compact
                className={
                  viewport.narrow
                    ? "flex h-full min-h-0 flex-col gap-2 space-y-0 [&>[role=toolbar]]:shrink-0 [&>p[id$='-help']]:sr-only"
                    : undefined
                }
                inputClassName={
                  viewport.narrow
                    ? "min-h-0! flex-1 resize-none overflow-y-auto overscroll-contain text-base! leading-7"
                    : "h-48 min-h-40 max-h-[50dvh] resize-y overflow-y-auto leading-7 @xl/preview:h-64"
                }
              />
            </div>
            {cleared !== null && !value && (
              <div className="flex shrink-0 items-center justify-between gap-2 border-t px-3 py-1 text-xs">
                <span role="status" className="text-muted-foreground">
                  Đã xóa nội dung thử.
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs"
                  onClick={() => change(cleared)}
                >
                  <Undo2 aria-hidden className="size-3.5" />
                  Khôi phục nội dung
                </Button>
              </div>
            )}
          </section>
          {viewport.narrow && (
            <PreviewDivider
              controls={editorId}
              value={splitRatio}
              onChange={viewport.keyboard ? setKeyboardRatio : setRatio}
            />
          )}
          <section
            aria-label="Kết quả hiển thị"
            className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card"
          >
            <div className="flex min-h-9 shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-muted/15 px-3 py-1 @xl/preview:min-h-12 @xl/preview:py-2">
              <h2 className="flex items-center gap-2 text-base font-bold">
                <Eye aria-hidden className="size-4 text-muted-foreground" />
                Kết quả hiển thị
              </h2>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  aria-hidden
                  className={cn("size-1.5 rounded-full", updating ? "bg-amber-500" : "bg-emerald-500")}
                />
                {updating ? "Đang cập nhật…" : "Trực tiếp"}
              </span>
            </div>
            <div
              ref={previewScroll}
              aria-busy={updating}
              tabIndex={0}
              aria-label="Nội dung xem trước"
              role="region"
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring @xl/preview:p-4",
                !viewport.narrow && "min-h-44 max-h-[60dvh] @xl/preview:min-h-64",
              )}
            >
              {output.text ? (
                <div className="whitespace-pre-wrap break-words text-sm leading-7">
                  <PreviewContent
                    text={output.text}
                    entities={output.entities}
                    locale={locale}
                    fallbackLocale={fallbackLocale}
                    autoRecognize={autoRecognize}
                    context={context}
                    resolveIcon={resolveIcon}
                  />
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center @xl/preview:min-h-36">
                  <span className="mb-1 hidden size-10 items-center justify-center rounded-xl border border-dashed bg-muted/30 text-muted-foreground @xl/preview:flex">
                    <Eye aria-hidden className="size-4" />
                  </span>
                  <p className="text-sm font-medium">Xem thay đổi khi bạn gõ</p>
                  <p className="max-w-52 text-xs leading-5 text-muted-foreground">
                    Nhập nội dung hoặc chọn Ví dụ để bắt đầu.
                  </p>
                </div>
              )}
            </div>
            <p className="hidden shrink-0 border-t px-3 py-2.5 text-xs leading-5 text-muted-foreground @xl/preview:block">
              Rê chuột hoặc chọn tham chiếu để kiểm tra thông tin.
            </p>
          </section>
        </div>
        <p className={cn("shrink-0 px-0.5 text-xs leading-5 text-muted-foreground", viewport.keyboard && "hidden")}>
          Nội dung thử không được lưu vào dữ liệu game.
        </p>
      </div>
    </section>
  )
}
