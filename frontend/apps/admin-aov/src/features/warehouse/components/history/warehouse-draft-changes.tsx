import { useQuery } from "@tanstack/react-query"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@aov/ui/components/tabs"
import type { WarehouseContent, WarehouseKind } from "@aov/ui/lib/warehouse-content"
import { errorMessage } from "@/lib/api/errors"
import { ChangeSections, changedRows } from "../../../publishing/components/patch-changes/hero-draft-changes"
import { warehouseApi, warehouseKeys } from "../../api/warehouse-api"
import {
  comparableData,
  languageChanges,
  wordDiff,
  type LanguageChange,
  type TextChange,
} from "../../model/warehouse-draft-diff"

/** The names of the warehouse data fields, so a change names the field in words rather than as a code. */
const FIELD_LABELS: Record<string, string> = {
  stats: "Chỉ số",
  key: "Mã",
  type: "Loại",
  value: "Giá trị",
  unit: "Đơn vị",
  iconAssetId: "Ảnh",
  notes: "Ghi chú",
  tier: "Cấp",
  price: "Giá",
  categoryCode: "Nhóm cửa hàng",
  shopPositions: "Vị trí trong cửa hàng",
  recipeStatus: "Tình trạng công thức",
  components: "Công thức",
  itemId: "Trang bị",
  quantity: "Số lượng",
  effects: "Hiệu ứng",
  activation: "Cách dùng",
  unique: "Duy nhất",
  maxStacks: "Cộng dồn tối đa",
  grants: "Chỉ số cộng thêm",
  stat: "Chỉ số",
  maxValue: "Giá trị tối đa",
  growth: "Tăng theo",
  scalings: "Tỷ lệ theo",
  source: "Nguồn",
  cap: "Giới hạn",
  durationSeconds: "Thời gian (giây)",
  target: "Đối tượng",
  branchCode: "Hệ",
  position: "Vị trí trong cấp",
  cooldownSeconds: "Hồi chiêu (giây)",
  cooldownMaxSeconds: "Hồi chiêu tối đa (giây)",
  maxUses: "Số lần dùng",
  availableFromSeconds: "Dùng được từ (giây)",
  availableUntilSeconds: "Dùng được đến (giây)",
  color: "Màu ngọc",
  unlockLevel: "Cấp mở khóa",
  unlockType: "Cách mở khóa",
  availability: "Tình trạng",
  legacy: "Phụ trợ cũ",
  displayOrder: "Thứ tự hiển thị",
  chargeRechargeSeconds: "Hồi mỗi lần tích (giây)",
  maxCharges: "Số lần tích trữ",
  defaultStateKey: "Dạng mặc định",
  referenceImages: "Ảnh tham khảo",
  assetId: "Ảnh",
  states: "Dạng",
}

const LANGUAGE_NAMES = new Intl.DisplayNames(["vi"], { type: "language" })
const languageName = (locale: string) => LANGUAGE_NAMES.of(locale) ?? locale

const KIND_NAMES: Record<LanguageChange["kind"], string> = {
  added: "Mới",
  removed: "Bị bỏ",
  changed: "Đã sửa",
}

/**
 * What a warehouse draft changes, as the hero page shows its drafts: the version the draft was made from against the
 * draft. A summary first, then the data before and after, then one tab per language the draft touches, so a draft that
 * adds several translations at once stays one short page.
 */
export function WarehouseDraftChanges({
  open,
  onOpenChange,
  kind,
  entryId,
  name,
  revisionNo,
  sourceRevisionId,
  content,
  locale,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: WarehouseKind
  entryId: string
  name: string
  revisionNo: number
  /** The version the draft was made from; a first draft has none. */
  sourceRevisionId: string | null | undefined
  /** The draft as it reads now. */
  content: WarehouseContent
  locale: string
}) {
  const source = useQuery({
    queryKey: warehouseKeys.revision(kind, entryId, sourceRevisionId ?? ""),
    queryFn: () => warehouseApi.read(kind, entryId, sourceRevisionId!),
    enabled: open && !!sourceRevisionId,
  })
  const before = source.data?.content as unknown as Record<string, unknown> | undefined
  const after = content as unknown as Record<string, unknown>
  const data = before ? changedRows(comparableData(before), comparableData(after), locale, FIELD_LABELS) : []
  const texts = before ? languageChanges(before, after, locale) : []
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="@container w-full gap-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b pr-12">
          <SheetTitle>Thay đổi trong nháp · {name}</SheetTitle>
          <SheetDescription>
            {sourceRevisionId && source.data
              ? `Bản #${revisionNo} so với bản #${source.data.revision.revisionNo}, bản dùng để tạo bản nháp này.`
              : `Bản #${revisionNo}`}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
          {!sourceRevisionId ? (
            <p role="status" className="type-body text-muted-foreground">
              Đây là bản đầu tiên của mục này, chưa có bản nào để so.
            </p>
          ) : source.isError ? (
            <p role="alert" className="type-body text-destructive">
              Chưa tải được bản dùng để tạo bản nháp: {errorMessage(source.error)}
            </p>
          ) : !source.data ? (
            <p role="status" className="type-body text-muted-foreground">
              Đang đọc bản dùng để tạo bản nháp…
            </p>
          ) : !data.length && !texts.length ? (
            <p role="status" className="type-body text-muted-foreground">
              Bản nháp này chưa có thay đổi nào.
            </p>
          ) : (
            <>
              <ChangeSummary dataCount={data.length} texts={texts} />
              {data.length > 0 && (
                <ChangeSections sections={[{ section: "data", name: "Dữ liệu", rows: data }]} locale={locale} />
              )}
              {texts.length > 0 && <LanguageTabs changes={texts} />}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** The draft at a glance: how much of the data it changes and what it does to each language. */
function ChangeSummary({ dataCount, texts }: { dataCount: number; texts: LanguageChange[] }) {
  const named = (kind: LanguageChange["kind"]) =>
    texts
      .filter((change) => change.kind === kind)
      .map((change) => languageName(change.locale))
      .join(", ")
  const facts = [
    dataCount > 0 && `Dữ liệu: ${dataCount} thay đổi`,
    named("changed") && `Sửa bản dịch: ${named("changed")}`,
    named("added") && `Thêm bản dịch: ${named("added")}`,
    named("removed") && `Bỏ bản dịch: ${named("removed")}`,
  ].filter((fact): fact is string => !!fact)
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Tóm tắt thay đổi">
      {facts.map((fact) => (
        <li key={fact} className="type-meta rounded-full border px-2.5 py-1 text-foreground">
          {fact}
        </li>
      ))}
    </ul>
  )
}

/** One tab per language the draft touches: a new language reads as its text, a changed one as its edits. */
function LanguageTabs({ changes }: { changes: LanguageChange[] }) {
  return (
    <section className="min-w-0 space-y-2" aria-label="Bản dịch">
      <h4 className="type-label">Bản dịch</h4>
      <Tabs defaultValue={changes[0].locale} className="gap-3">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          {changes.map((change) => (
            <TabsTrigger key={change.locale} value={change.locale} className="flex-none gap-1.5">
              {languageName(change.locale)}
              <span className="type-meta">
                · {change.kind === "changed" ? `${change.fields.length} thay đổi` : KIND_NAMES[change.kind]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        {changes.map((change) => (
          <TabsContent key={change.locale} value={change.locale} className="space-y-2">
            <p className="type-meta">
              {change.kind === "added"
                ? "Bản dịch mới, chưa có trong bản đã xuất bản."
                : change.kind === "removed"
                  ? "Bản nháp bỏ bản dịch này. Nội dung cũ:"
                  : "Chữ gạch đỏ bị bỏ, chữ nền xanh được thêm."}
            </p>
            <div className="divide-y rounded-lg border">
              {change.fields.map((field) => (
                <TextField key={field.label} field={field} />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </section>
  )
}

/** One field of a language: the text itself when only one side has it, or its edits word by word. */
function TextField({ field }: { field: TextChange }) {
  return (
    <div className="min-w-0 space-y-1 p-3">
      <h5 className="type-meta break-words">{field.label}</h5>
      <p className="type-body whitespace-pre-wrap [overflow-wrap:anywhere]">
        {field.before === null || field.after === null ? (
          <span className={field.after === null ? "text-muted-foreground line-through" : undefined}>
            {field.after ?? field.before}
          </span>
        ) : (
          wordDiff(field.before, field.after).map((piece, index) =>
            piece.kind === "same" ? (
              <span key={index}>{piece.text}</span>
            ) : piece.kind === "removed" ? (
              <del key={index} className="rounded-sm bg-destructive/10 text-destructive">
                {piece.text}
              </del>
            ) : (
              <ins key={index} className="rounded-sm bg-(--aov-success-soft) text-(--aov-success) no-underline">
                {piece.text}
              </ins>
            ),
          )
        )}
      </p>
    </div>
  )
}
