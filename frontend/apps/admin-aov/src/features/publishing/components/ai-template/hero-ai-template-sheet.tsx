import { useMemo, useRef, useState } from "react"
import { ArrowRight, Check, CircleAlert, ClipboardCopy, Download, FileJson, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { publishingKeys } from "@/lib/api/publishing-api"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@aov/ui/components/tabs"
import { Textarea } from "@aov/ui/components/textarea"
import { cn } from "@aov/ui/lib/utils"
import { NativeSelect } from "@/components/native-select"
import { downloadFile } from "@/lib/download-file"
import { SECTIONS, type Content } from "@/lib/hero-types"
import { languageOptions } from "../../../users/profile-preference-picker"
import { SHEET_TAB, SHEET_TAB_LIST } from "../../../warehouse/components/sheet/warehouse-sheet"
import {
  applyHeroAiAnswer,
  heroAiData,
  heroAiGuide,
  heroAiPrompt,
  parseHeroAiAnswer,
  type HeroAiResult,
} from "../../model/ai-template/hero-ai-template"

/** The hero code from a hero list already loaded on the page; the workspace itself reads revisions, which have none. */
export function useCachedHeroCode(heroId: string) {
  const cache = useQueryClient()
  if (!heroId) return null
  for (const [, data] of cache.getQueriesData<unknown>({ queryKey: publishingKeys.heroes })) {
    const pages = (data as { pages?: { items?: unknown[] }[] } | undefined)?.pages
    const rows = pages ? pages.flatMap((page) => page.items ?? []) : ((data as { items?: unknown[] })?.items ?? [])
    for (const row of rows) {
      const hero = row as { id?: string; code?: string }
      if (hero.id === heroId && hero.code) return hero.code
    }
  }
  return null
}

const sectionLabel = (key: string) => SECTIONS.find(([section]) => section === key)?.[2] ?? key

/**
 * The fields of a hero in a form an AI assistant can fill in: the list with what each one means and what this hero
 * still lacks, the prompt to copy, and the way back. A pasted answer is checked, shown as old → new, and only goes into
 * the draft as unsaved changes, which are reviewed and saved section by section like any other edit.
 */
export function HeroAiTemplateSheet({
  open,
  onOpenChange,
  content,
  heroName,
  heroCode,
  locale: initialLocale,
  writable,
  draftAction,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  content: Content
  heroName: string
  heroCode: string | null
  locale: string
  /** The version on screen is a draft this account may change. */
  writable: boolean
  /** Opens or starts the draft when the version on screen cannot take the answer. */
  draftAction?: { label: string; onSelect: () => void }
  onApply: (content: Content) => void
}) {
  const [tab, setTab] = useState("template")
  const [locale, setLocale] = useState(initialLocale)
  const [answer, setAnswer] = useState("")
  const [checked, setChecked] = useState<{ result?: HeroAiResult; error?: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const guide = useMemo(() => heroAiGuide(content, locale), [content, locale])
  const data = useMemo(() => heroAiData(content, locale, heroCode), [content, locale, heroCode])
  const missing = guide.flatMap((group) => group.fields).filter((field) => field.filled === false).length
  const counted = guide.flatMap((group) => group.fields).filter((field) => field.filled !== undefined).length

  const fileName = `${heroCode || "tuong-moi"}-${locale}.json`
  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(heroAiPrompt(heroName, data, guide))
      toast.success("Đã sao chép lời nhắc. Dán vào AI, rồi mang kết quả về bước 2.")
    } catch {
      toast.error("Trình duyệt chặn sao chép. Hãy tải tệp JSON thay thế.")
    }
  }
  function check(text: string) {
    const parsed = parseHeroAiAnswer(text)
    if (!parsed.ok) return setChecked({ error: parsed.message })
    setChecked({ result: applyHeroAiAnswer(content, parsed.answer) })
  }
  function apply() {
    if (!checked?.result?.changes.length) return
    onApply(checked.result.content)
    toast.success("Đã đưa vào bản nháp. Các phần đổi hiện là chưa lưu: mở từng phần để xem lại rồi bấm Lưu.")
    setAnswer("")
    setChecked(null)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b pr-12">
          <SheetTitle className="type-section-title flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Mẫu dữ liệu cho AI
          </SheetTitle>
          <SheetDescription className="type-meta">
            Lấy các trường cần nhập của {heroName || "tướng"} để gửi cho AI, rồi dán kết quả vào bản nháp.
          </SheetDescription>
        </SheetHeader>
        <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 gap-0">
          <TabsList variant="line" className={SHEET_TAB_LIST}>
            <TabsTrigger value="template" className={SHEET_TAB}>
              1. Lấy mẫu
            </TabsTrigger>
            <TabsTrigger value="answer" className={SHEET_TAB}>
              2. Dán kết quả
            </TabsTrigger>
          </TabsList>

          <TabsContent value="template" className="min-h-0 space-y-4 overflow-y-auto p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1.5">
                <span className="type-label">Ngôn ngữ</span>
                <NativeSelect value={locale} onChange={(event) => setLocale(event.target.value)}>
                  {languageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <p className="type-meta pb-2">
                {missing ? `Còn trống ${missing}/${counted} trường` : "Đã có đủ các trường"} bằng ngôn ngữ này.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void copyPrompt()}>
                <ClipboardCopy />
                Sao chép lời nhắc cho AI
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => downloadFile(fileName, `${JSON.stringify(data, null, 2)}\n`)}
              >
                <Download />
                Tải tệp JSON
              </Button>
            </div>
            <p className="type-meta">
              Lời nhắc gồm quy tắc, ý nghĩa từng trường và JSON đã điền sẵn dữ liệu hiện có. Trường nào AI không chắc sẽ
              để null và giữ nguyên khi đưa về. Ảnh, nguồn và hiệu ứng kỹ năng không nằm trong mẫu.
            </p>
            {guide.map((group) => {
              const empty = group.fields.filter((field) => field.filled === false).length
              return (
                <section key={group.section} className="rounded-lg border">
                  <h3 className="type-label flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                    <span>{group.title}</span>
                    <span className={empty ? "text-(--aov-warning)" : "text-muted-foreground"}>
                      {empty ? `${empty} còn trống` : "Đủ"}
                    </span>
                  </h3>
                  <ul className="divide-y">
                    {group.fields.map((field) => (
                      <li key={field.path} className="grid grid-cols-[1rem_1fr] gap-x-2 px-3 py-2">
                        <span
                          className={cn(
                            "mt-1.5 size-2 rounded-full",
                            field.filled === undefined
                              ? "bg-border"
                              : field.filled
                                ? "bg-(--aov-success)"
                                : "bg-(--aov-warning)",
                          )}
                          aria-label={field.filled === undefined ? "Mã" : field.filled ? "Đã có" : "Còn trống"}
                        />
                        <div className="min-w-0">
                          <p className="type-body flex flex-wrap items-baseline gap-x-2">
                            <span className="font-semibold">{field.label}</span>
                            <code className="type-meta">{field.path}</code>
                            <span className="type-meta">· {field.type}</span>
                          </p>
                          <p className="type-meta">{field.note}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </TabsContent>

          <TabsContent value="answer" className="min-h-0 space-y-4 overflow-y-auto p-4">
            {!writable && (
              <div className="rounded-lg border border-(--aov-warning)/40 bg-(--aov-warning-soft) p-3">
                <p className="type-body">
                  Phiên bản đang xem không phải bản nháp. Bạn vẫn có thể dán để xem trước thay đổi; để đưa vào, hãy mở
                  bản nháp.
                </p>
                {draftAction && (
                  <Button type="button" size="sm" variant="outline" className="mt-2" onClick={draftAction.onSelect}>
                    {draftAction.label}
                  </Button>
                )}
              </div>
            )}
            <label className="grid gap-1.5">
              <span className="type-label">Kết quả AI trả về</span>
              <Textarea
                value={answer}
                onChange={(event) => {
                  setAnswer(event.target.value)
                  setChecked(null)
                }}
                rows={10}
                spellCheck={false}
                className="font-mono text-xs"
                placeholder='Dán cả câu trả lời của AI, Admin sẽ tự tìm khối JSON { "format": "aov-hero/1", … }'
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={!answer.trim()} onClick={() => check(answer)}>
                <Check />
                Kiểm tra
              </Button>
              <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
                <FileJson />
                Chọn tệp JSON
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json,.txt"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ""
                  if (!file) return
                  const text = await file.text()
                  setAnswer(text)
                  check(text)
                }}
              />
            </div>
            {checked?.error && (
              <p role="alert" className="type-body flex gap-2 rounded-lg bg-destructive/10 p-3 text-destructive">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                {checked.error}
              </p>
            )}
            {checked?.result && <AnswerPreview result={checked.result} />}
            {checked?.result && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
                <p className="type-meta mr-auto">Chưa có gì được lưu cho đến khi bạn bấm Lưu ở từng phần.</p>
                <Button type="button" disabled={!writable || !checked.result.changes.length} onClick={apply}>
                  Đưa vào bản nháp
                  {checked.result.changes.length ? ` (${checked.result.changes.length})` : ""}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

function AnswerPreview({ result }: { result: HeroAiResult }) {
  const sections = [...new Set(result.changes.map((change) => change.section))]
  return (
    <div className="space-y-3">
      {result.warnings.length > 0 && (
        <ul className="type-body space-y-1 rounded-lg bg-(--aov-warning-soft) p-3">
          {result.warnings.map((warning) => (
            <li key={warning} className="flex gap-2">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-(--aov-warning)" />
              {warning}
            </li>
          ))}
        </ul>
      )}
      {!result.changes.length ? (
        <p className="type-body text-muted-foreground">Kết quả không khác gì dữ liệu hiện có.</p>
      ) : (
        sections.map((section) => (
          <section key={section} className="rounded-lg border">
            <h3 className="type-label border-b bg-muted/40 px-3 py-2">{sectionLabel(section)}</h3>
            <ul className="divide-y">
              {result.changes
                .filter((change) => change.section === section)
                .map((change, index) => (
                  <li key={`${change.label}-${index}`} className="grid gap-1 px-3 py-2">
                    <span className="type-label">{change.label}</span>
                    <span className="type-body grid grid-cols-[1fr_auto_1fr] items-start gap-2">
                      <span className="break-words text-muted-foreground line-through decoration-muted-foreground/50">
                        {change.before}
                      </span>
                      <ArrowRight className="mt-0.5 size-4 text-muted-foreground" />
                      <span className="break-words">{change.after}</span>
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
