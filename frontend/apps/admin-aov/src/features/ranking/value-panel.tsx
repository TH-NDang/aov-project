import { useEffect, useMemo, useState } from "react"
import { Check, ChevronRight, Expand, Flag } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aov/ui/components/dialog"
import { Input } from "@aov/ui/components/input"
import { Label } from "@aov/ui/components/label"
import { LocalTime } from "@aov/ui/components/local-time"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { Textarea } from "@aov/ui/components/textarea"
import { errorMessage } from "@/lib/api/errors"
import { EvidenceCrop, around, nameArea, rowArea } from "./evidence"
import type { RankingDetail, RankingHero, RankingMetric, RankingValue } from "./ranking-api"
import { METRICS, ROLE_LABELS, editText, formatValue, parseNumber } from "./ranking-model"
import { HeroFace } from "./ranking-table"
import { useReviewValue } from "./use-ranking"

const TIERS = ["T0", "T1", "T2", "T3", "T4", "T5"]
const BOARD_LABELS = { RATES: "bảng Tỷ lệ", FIGURES: "bảng Chỉ số" } as const

export interface OpenValue {
  heroId: string
  metric: RankingMetric
}

/**
 * One value next to the screenshot it was read from: the whole row (so the hero's name and the number read together),
 * the cell enlarged, and the full screenshot on demand. An editor confirms it, types the right value, or flags it.
 */
export function ValuePanel({
  detail,
  open,
  heads,
  canWrite,
  nextOpen,
  onOpen,
  onClose,
}: {
  detail: RankingDetail
  open: OpenValue | null
  heads: Map<string, string> | undefined
  canWrite: boolean
  /** The next value still waiting for review, after this one. */
  nextOpen: OpenValue | null
  onOpen: (value: OpenValue) => void
  onClose: () => void
}) {
  const hero = detail.heroes.find((entry) => entry.heroId === open?.heroId)
  const value = hero?.values.find((entry) => entry.metric === open?.metric)
  return (
    <Sheet open={!!open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
        {hero && value ? (
          <ValueBody
            key={`${hero.heroId}:${value.metric}`}
            detail={detail}
            hero={hero}
            value={value}
            heads={heads}
            canWrite={canWrite}
            nextOpen={nextOpen}
            onOpen={onOpen}
          />
        ) : (
          <SheetHeader>
            <SheetTitle>Giá trị</SheetTitle>
            <SheetDescription>Không tìm thấy giá trị này trong bản chụp.</SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  )
}

function ValueBody({
  detail,
  hero,
  value,
  heads,
  canWrite,
  nextOpen,
  onOpen,
}: {
  detail: RankingDetail
  hero: RankingHero
  value: RankingValue
  heads: Map<string, string> | undefined
  canWrite: boolean
  nextOpen: OpenValue | null
  onOpen: (value: OpenValue) => void
}) {
  const info = METRICS[value.metric]
  const image = value.source && detail.images.find((entry) => entry.imageId === value.source!.imageId)
  const [full, setFull] = useState(false)
  const [text, setText] = useState(editText(value))
  const [tier, setTier] = useState(value.tier ?? "")
  const [counter, setCounter] = useState(value.heroId ?? "")
  const [note, setNote] = useState(value.note ?? "")
  const [saved, setSaved] = useState<"confirmed" | "flagged" | null>(null)
  const review = useReviewValue(detail.id)
  const options = useMemo(
    () => [...detail.heroes].sort((a, b) => a.nameOnScreen.localeCompare(b.nameOnScreen, "vi")),
    [detail.heroes],
  )
  useEffect(() => setSaved(null), [text, tier, counter, note])

  const number = info.kind === "PERCENT" || info.kind === "AMOUNT" ? parseNumber(text) : null
  const typedInvalid = (info.kind === "PERCENT" || info.kind === "AMOUNT") && text.trim() !== "" && number == null
  const content =
    info.kind === "TIER"
      ? { tier: tier || null }
      : info.kind === "HERO"
        ? { heroId: counter || null }
        : { number: number }
  const empty = Object.values(content).every((entry) => entry == null)
  const changed =
    info.kind === "TIER"
      ? (tier || null) !== value.tier
      : info.kind === "HERO"
        ? (counter || null) !== value.heroId
        : number !== value.number
  const counterHero = detail.heroes.find((entry) => entry.heroId === value.heroId)

  const save = (needsReview: boolean) =>
    review.mutate(
      {
        heroId: hero.heroId,
        metric: value.metric,
        body: { expectedVersion: value.version, ...content, needsReview, note: note.trim() || null },
      },
      { onSuccess: () => setSaved(needsReview ? "flagged" : "confirmed") },
    )

  return (
    <div className="flex flex-col gap-5 p-4">
      <SheetHeader className="p-0">
        <div className="flex items-center gap-3">
          <HeroFace code={hero.heroCode} name={hero.nameOnScreen} heads={heads} className="size-10" />
          <div className="min-w-0">
            <SheetTitle>
              {hero.nameOnScreen} · {info.label}
            </SheetTitle>
            <SheetDescription className="type-meta">
              {ROLE_LABELS[hero.roleOnScreen]} · <code>{hero.heroCode}</code>
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <section className="grid grid-cols-3 gap-3" aria-label="Giá trị">
        <Fact label="Đang lưu">{info.kind === "HERO" ? (counterHero?.nameOnScreen ?? "—") : formatValue(value)}</Fact>
        <Fact label="Chữ đọc trên ảnh">{value.readText ?? (info.kind === "HERO" ? "Chân dung" : "—")}</Fact>
        <Fact label="Trạng thái">
          {value.needsReview ? (
            <span className="text-[var(--aov-warning)]">Chờ duyệt</span>
          ) : value.reviewedAt ? (
            <span className="text-[var(--aov-success)]">
              Đã duyệt <LocalTime value={value.reviewedAt} format={{ dateStyle: "short" }} />
            </span>
          ) : (
            "Đọc từ ảnh"
          )}
        </Fact>
      </section>

      {value.note && (
        <p
          className={
            value.needsReview
              ? "rounded-md bg-[var(--aov-warning-soft)] px-3 py-2 type-body"
              : "rounded-md bg-muted px-3 py-2 type-body"
          }
        >
          {value.note}
        </p>
      )}

      <section className="grid gap-2" aria-label="Ảnh dẫn chứng">
        <div className="flex items-center justify-between gap-2">
          <h3 className="type-label">Ảnh dẫn chứng</h3>
          {image && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setFull(true)}>
              <Expand className="size-4" /> Xem cả ảnh
            </Button>
          )}
        </div>
        {image && value.source ? (
          <>
            <EvidenceCrop
              image={image}
              area={rowArea(value.source, image)}
              highlight={value.source}
              label={`Dòng của ${hero.nameOnScreen} trên ảnh`}
            />
            <div className="flex flex-wrap items-end gap-3">
              <figure className="grid gap-1">
                <EvidenceCrop
                  image={image}
                  area={nameArea(value.source, image)}
                  className="h-20"
                  label={`Tên ${hero.nameOnScreen} trên ảnh`}
                />
                <figcaption className="type-meta text-muted-foreground">Tên trên ảnh</figcaption>
              </figure>
              <figure className="grid gap-1">
                <EvidenceCrop
                  image={image}
                  area={around(value.source, image, 12)}
                  highlight={value.source}
                  className="h-20"
                  label={`Ô ${info.label} trên ảnh`}
                />
                <figcaption className="type-meta text-muted-foreground">Ô {info.short.toLowerCase()}</figcaption>
              </figure>
              {info.kind === "HERO" && counterHero && (
                <figure className="grid gap-1">
                  <HeroFace
                    code={counterHero.heroCode}
                    name={counterHero.nameOnScreen}
                    heads={heads}
                    className="size-20 rounded-full"
                  />
                  <figcaption className="type-meta text-muted-foreground">
                    {counterHero.nameOnScreen} trên Wiki
                  </figcaption>
                </figure>
              )}
            </div>
            <p className="type-meta text-muted-foreground">
              Trang {image.pageNo}, {BOARD_LABELS[image.board]} · {image.fileName} · x {value.source.x}, y{" "}
              {value.source.y}
            </p>
          </>
        ) : (
          <p className="rounded-md border border-dashed px-3 py-4 type-meta text-muted-foreground">
            Giá trị này không có trên ảnh nào của bản chụp.
          </p>
        )}
      </section>

      <section className="grid gap-3 border-t pt-4" aria-label="Duyệt">
        <h3 className="type-label">Duyệt giá trị</h3>
        {info.kind === "TIER" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="ranking-tier">Tier</Label>
            <Select value={tier} onValueChange={setTier} disabled={!canWrite}>
              <SelectTrigger id="ranking-tier" className="w-32">
                <SelectValue placeholder="Chưa có" />
              </SelectTrigger>
              <SelectContent>
                {TIERS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : info.kind === "HERO" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="ranking-counter">Tướng trên chân dung</Label>
            <Select value={counter} onValueChange={setCounter} disabled={!canWrite}>
              <SelectTrigger id="ranking-counter" className="w-full">
                <SelectValue placeholder="Chọn tướng" />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.heroId} value={option.heroId}>
                    {option.nameOnScreen} · {ROLE_LABELS[option.roleOnScreen]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="ranking-number">
              {info.label}
              {info.kind === "PERCENT" ? " (%)" : ""}
            </Label>
            <Input
              id="ranking-number"
              inputMode="decimal"
              value={text}
              disabled={!canWrite}
              aria-invalid={typedInvalid}
              placeholder={info.kind === "PERCENT" ? "49,42" : "130.189,10"}
              onChange={(event) => setText(event.target.value)}
              className="w-48 tabular-nums"
            />
            {typedInvalid && (
              <p className="type-meta text-destructive">Nhập số như trên game, tối đa hai chữ số sau dấu phẩy.</p>
            )}
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="ranking-note">Ghi chú</Label>
          <Textarea
            id="ranking-note"
            rows={2}
            value={note}
            disabled={!canWrite}
            maxLength={1000}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        {review.isError && <p className="type-body text-destructive">{errorMessage(review.error)}</p>}
        {saved && (
          <p className="type-body text-[var(--aov-success)]">
            {saved === "confirmed" ? "Đã lưu và bỏ cờ chờ duyệt." : "Đã đánh dấu chờ duyệt."}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={!canWrite || review.isPending || empty || typedInvalid}
            onClick={() => save(false)}
          >
            <Check className="size-4" /> {changed ? "Lưu giá trị đã sửa" : "Xác nhận đúng"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canWrite || review.isPending || typedInvalid}
            onClick={() => save(true)}
          >
            <Flag className="size-4" /> Cần xem lại
          </Button>
          {nextOpen && (
            <Button type="button" variant="ghost" className="ml-auto" onClick={() => onOpen(nextOpen)}>
              Chờ duyệt tiếp theo <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
        {!canWrite && <p className="type-meta text-muted-foreground">Cần quyền hero:write để duyệt.</p>}
      </section>

      {image && value.source && (
        <Dialog open={full} onOpenChange={setFull}>
          <DialogContent className="max-w-[min(96vw,1400px)] sm:max-w-[min(96vw,1400px)]">
            <DialogHeader>
              <DialogTitle>{image.fileName}</DialogTitle>
              <DialogDescription>
                {hero.nameOnScreen} · {info.label}: khung vàng là vùng đọc giá trị.
              </DialogDescription>
            </DialogHeader>
            <EvidenceCrop
              image={image}
              area={{ x: 0, y: 0, width: image.width, height: image.height }}
              highlight={value.source}
              label={`Toàn bộ ${image.fileName}`}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <span className="type-meta text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{children}</span>
    </div>
  )
}
