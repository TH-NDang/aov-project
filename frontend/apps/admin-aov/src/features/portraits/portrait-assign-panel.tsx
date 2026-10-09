import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router"
import { Check, ChevronsUpDown, ListChecks, Sparkles, TriangleAlert, Wand2 } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@aov/ui/components/alert"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@aov/ui/components/command"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@aov/ui/components/field"
import { Input } from "@aov/ui/components/input"
import { Kbd, KbdGroup } from "@aov/ui/components/kbd"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { RadioGroup, RadioGroupItem } from "@aov/ui/components/radio-group"
import { Separator } from "@aov/ui/components/separator"
import { Spinner } from "@aov/ui/components/spinner"
import { ToggleGroup, ToggleGroupItem } from "@aov/ui/components/toggle-group"
import { cn } from "@aov/ui/lib/utils"
import type { Hero, PortraitRole } from "@/lib/api/types"
import { BadgePicker } from "@/components/badge-picker"
import { HeroPicker } from "@/components/hero-picker"
import { MediaImage } from "@/components/media-image"
import { nameFromFigma, planPortraitMove, type PortraitMoveRequest, type PortraitTarget } from "@/lib/domain/portraits"
import { fileName as baseName } from "@/lib/media"
import { useBadges, useMovePortrait } from "@/lib/queries"
import { commandFilter, formatBytes, slugify } from "@/lib/text"
import type { HeroIndex } from "@/lib/use-wiki-index"
import type { PortraitRow } from "./portraits-page"

type TargetMode = PortraitTarget["kind"]

interface Draft {
  heroId: string | null
  mode: TargetMode
  skinId: string | null
  name: string
  fileName: string
  autoFileName: boolean
  badgeId: string | null
  role: PortraitRole
}

const autoName = (hero: Hero | undefined, mode: TargetMode, name: string) =>
  `${slugify(mode === "hero" ? (hero?.name ?? "") : `${hero?.name ?? ""} ${name}`)}-portrait.png`

function initialDraft(row: PortraitRow): Draft {
  if (row.owner && row.hero) {
    return {
      heroId: row.hero.id,
      mode: row.owner.skinId ? "skin" : "hero",
      skinId: row.owner.skinId,
      name: row.skin?.name ?? "",
      fileName: row.skin?.portraitFileName ?? baseName(row.source.file),
      autoFileName: false,
      badgeId: row.skin?.badgeId ?? null,
      role: row.owner.role,
    }
  }
  const name = nameFromFigma(row.source.figmaName)
  return {
    heroId: row.hero?.id ?? null,
    mode: "new-skin",
    skinId: null,
    name,
    fileName: autoName(row.hero, "new-skin", name),
    autoFileName: true,
    badgeId: null,
    role: "primary",
  }
}

interface PortraitAssignPanelProps {
  row: PortraitRow
  index: HeroIndex
  onDirtyChange: (dirty: boolean) => void
  onSaved: (goNext: boolean) => void
}

export function PortraitAssignPanel({ row, index, onDirtyChange, onSaved }: PortraitAssignPanelProps) {
  const badges = useBadges()
  const move = useMovePortrait()
  const [initial] = useState(() => initialDraft(row))
  const [draft, setDraft] = useState<Draft>(initial)
  const hero = draft.heroId ? index.heroById.get(draft.heroId) : undefined
  const targetSkin = draft.mode === "skin" ? hero?.skins.find((skin) => skin.id === draft.skinId) : undefined
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  const patch = (changes: Partial<Draft>) =>
    setDraft((current) => {
      const next = { ...current, ...changes }
      if (next.autoFileName)
        next.fileName = autoName(next.heroId ? index.heroById.get(next.heroId) : undefined, next.mode, next.name)
      return next
    })

  const pickSkin = (skinId: string, owner: Hero | undefined = hero) => {
    const skin = owner?.skins.find((candidate) => candidate.id === skinId)
    patch({ heroId: owner?.id ?? null, skinId, mode: "skin", name: skin?.name ?? "", badgeId: skin?.badgeId ?? null })
  }

  const request: PortraitMoveRequest | null =
    hero && (draft.mode !== "skin" || targetSkin)
      ? {
          file: row.source.file,
          heroId: hero.id,
          target: draft.mode === "skin" ? { kind: "skin", skinId: targetSkin!.id } : { kind: draft.mode },
          name: draft.name,
          fileName: draft.fileName.trim() || autoName(hero, draft.mode, draft.name),
          badgeId: draft.mode === "hero" ? null : draft.badgeId,
          role: draft.role,
        }
      : null

  const plan = useMemo(() => {
    if (!request) return { steps: [] as string[], error: "Chọn tướng và nơi nhận ảnh." }
    try {
      return { steps: planPortraitMove(index.heroes, request).steps, error: null }
    } catch (error) {
      return { steps: [] as string[], error: error instanceof Error ? error.message : String(error) }
    }
  }, [index.heroes, request])

  const fileNameError = !/^[a-z0-9]+(?:-[a-z0-9]+)*-portrait\.png$/.test(draft.fileName.trim())
    ? "Tên file chỉ gồm chữ thường không dấu, số, gạch ngang và kết thúc bằng -portrait.png."
    : null
  const canSave = !!request && !plan.error && !fileNameError && !move.isPending

  const save = (goNext: boolean) => {
    if (!request || !canSave) return
    const expectedVersions: Record<string, number> = { [request.heroId]: index.heroById.get(request.heroId)!.version }
    if (row.owner) expectedVersions[row.owner.heroId] = index.heroById.get(row.owner.heroId)!.version
    move.mutate(
      { ...request, expectedVersions },
      {
        onSuccess: () => {
          toast.success("Đã lưu portrait.", { description: plan.steps.at(-2) })
          onSaved(goNext)
        },
      },
    )
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        save(event.shiftKey)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  })

  const suggestions = !row.owner && row.hero ? row.source.suggestions : []
  const reference = draft.mode === "hero" ? hero : targetSkin

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5 p-5">
        <div className="flex gap-4 pr-8">
          <MediaImage
            path={row.source.file}
            alt={row.title}
            className="w-24 shrink-0 rounded-md border object-cover"
            fallbackClassName="aspect-[278/436] w-24 rounded-md border"
          />
          <div className="min-w-0 space-y-1 text-sm">
            <p className="text-xs text-muted-foreground">Đang ở</p>
            <p className="font-semibold">{row.ownerText}</p>
            {row.owner && <Badge variant="outline">{row.owner.role === "primary" ? "Ảnh chính" : "Bản khác"}</Badge>}
            <p className="text-xs text-muted-foreground">Figma: {row.source.figmaName}</p>
            <p className="truncate font-mono text-[11px] text-muted-foreground" title={row.source.file}>
              {row.source.file}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {row.source.width}×{row.source.height} · {formatBytes(row.source.bytes)}
            </p>
          </div>
        </div>

        {suggestions.length > 0 && (
          <Alert>
            <Sparkles />
            <AlertTitle>Gợi ý ghép theo tên</AlertTitle>
            <AlertDescription>
              <p>Độ khớp thấp thường là trang phục mới chưa có trong danh mục.</p>
              <div className="mt-2 flex w-full flex-col gap-1.5">
                {suggestions.map(([score, sourceSkinId, title]) => {
                  const skin = row.hero!.skins.find((candidate) => candidate.sourceSkinId === sourceSkinId)
                  if (!skin) return null
                  return (
                    <button
                      key={sourceSkinId}
                      type="button"
                      onClick={() => pickSkin(skin.id, row.hero)}
                      className={cn(
                        "flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-left text-foreground hover:bg-accent",
                        draft.skinId === skin.id && "ring-2 ring-primary",
                      )}
                    >
                      <MediaImage path={skin.portrait} className="h-8 w-5 rounded-sm object-cover" />
                      <span className="min-w-0 flex-1 truncate">{title}</span>
                      <span className="font-mono text-xs tabular-nums">{Math.round(score * 100)}%</span>
                    </button>
                  )
                })}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <FieldSet>
          <FieldLegend>1. Chọn nơi nhận</FieldLegend>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="target-hero">Tướng nhận ảnh</FieldLabel>
              <HeroPicker
                id="target-hero"
                heroes={index.heroes}
                value={draft.heroId}
                onChange={(heroId) =>
                  patch({ heroId, skinId: null, mode: draft.mode === "skin" ? "new-skin" : draft.mode })
                }
              />
            </Field>
            <ToggleGroup
              type="single"
              variant="outline"
              value={draft.mode}
              onValueChange={(value) =>
                value &&
                patch({
                  mode: value as TargetMode,
                  ...(value === "new-skin" && !draft.name ? { name: nameFromFigma(row.source.figmaName) } : {}),
                })
              }
              className="w-full"
            >
              <ToggleGroupItem value="skin" className="flex-1">
                Trang phục có sẵn
              </ToggleGroupItem>
              <ToggleGroupItem value="new-skin" className="flex-1">
                Trang phục mới
              </ToggleGroupItem>
              <ToggleGroupItem value="hero" className="flex-1">
                Ảnh tướng
              </ToggleGroupItem>
            </ToggleGroup>
            {draft.mode === "skin" && hero && <SkinPicker hero={hero} value={draft.skinId} onChange={pickSkin} />}
            {draft.mode === "new-skin" && (
              <FieldDescription>Trang phục mới chỉ cần portrait. Head và cover có thể bổ sung sau.</FieldDescription>
            )}
            {reference && (
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
                <span className="text-xs text-muted-foreground">Mục nhận hiện tại</span>
                {[reference.portrait, reference.head, reference.cover].filter(Boolean).map((path) => (
                  <MediaImage key={path} path={path} className="h-12 w-auto max-w-20 rounded-sm border object-cover" />
                ))}
                {!reference.portrait && <Badge variant="outline">Chưa có portrait</Badge>}
              </div>
            )}
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>2. Kiểm tra hoặc sửa tên</FieldLegend>
          <FieldGroup className="gap-4">
            {draft.mode !== "hero" && (
              <Field>
                <FieldLabel htmlFor="target-name">Tên trang phục</FieldLabel>
                <Input
                  id="target-name"
                  value={draft.name}
                  maxLength={180}
                  autoComplete="off"
                  onChange={(event) => patch({ name: event.target.value })}
                />
                {hero && (
                  <FieldDescription>
                    Tên đầy đủ: {hero.name} {draft.name}
                  </FieldDescription>
                )}
              </Field>
            )}
            <Field data-invalid={!!fileNameError}>
              <FieldLabel htmlFor="target-file">Tên file portrait</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="target-file"
                  value={draft.fileName}
                  className="font-mono text-xs"
                  aria-invalid={!!fileNameError}
                  onChange={(event) => patch({ fileName: event.target.value, autoFileName: false })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => patch({ autoFileName: true })}
                  aria-label="Dùng tên file tự động"
                  title="Dùng tên file tự động"
                >
                  <Wand2 />
                </Button>
              </div>
              <FieldDescription>
                {fileNameError ??
                  (draft.autoFileName ? "Đang dùng tên tự động theo tướng và trang phục." : "Đã sửa tay.")}
              </FieldDescription>
            </Field>
            {draft.mode !== "hero" && (
              <Field>
                <FieldLabel htmlFor="target-badge">Bậc trang phục</FieldLabel>
                <BadgePicker
                  id="target-badge"
                  badges={badges.data ?? []}
                  value={draft.badgeId}
                  onChange={(badgeId) => patch({ badgeId })}
                  usage={index.badgeUsage}
                />
              </Field>
            )}
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>3. Cách dùng ảnh</FieldLegend>
          <RadioGroup
            value={draft.role}
            onValueChange={(value) => patch({ role: value as PortraitRole })}
            className="grid grid-cols-2 gap-2"
          >
            {(
              [
                ["primary", "Làm ảnh chính", "Ảnh chính cũ thành bản khác"],
                ["alternate", "Giữ làm bản khác", "Không đổi ảnh chính"],
              ] as const
            ).map(([value, title, description]) => (
              <FieldLabel key={value} htmlFor={`role-${value}`}>
                <Field orientation="horizontal">
                  <RadioGroupItem value={value} id={`role-${value}`} />
                  <FieldContent>
                    <FieldTitle>{title}</FieldTitle>
                    <FieldDescription>{description}</FieldDescription>
                  </FieldContent>
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>
        </FieldSet>

        <Separator />
        {plan.error ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Chưa thể lưu</AlertTitle>
            <AlertDescription>{plan.error}</AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <ListChecks />
            <AlertTitle>Khi lưu sẽ</AlertTitle>
            <AlertDescription>
              <ol className="list-decimal space-y-1 pl-4">
                {plan.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </AlertDescription>
          </Alert>
        )}
        {hero && (
          <p className="text-xs text-muted-foreground">
            Xem toàn bộ trang phục của{" "}
            <Link to={`/heroes/${hero.id}?tab=skins`} className="underline underline-offset-4">
              {hero.name}
            </Link>
            .
          </p>
        )}
      </div>

      <div className="sticky bottom-0 space-y-1.5 border-t bg-background/95 px-5 py-3 backdrop-blur">
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={!canSave} onClick={() => save(true)}>
            Lưu & ảnh tiếp
          </Button>
          <Button disabled={!canSave} onClick={() => save(false)}>
            {move.isPending && <Spinner />} Lưu ảnh này
          </Button>
        </div>
        <p className="text-right text-[11px] text-muted-foreground">
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>Enter</Kbd>
          </KbdGroup>{" "}
          lưu · thêm <Kbd>Shift</Kbd> để sang ảnh tiếp
        </p>
      </div>
    </div>
  )
}

function SkinPicker({
  hero,
  value,
  onChange,
}: {
  hero: Hero
  value: string | null
  onChange: (skinId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const skins = hero.skins.filter((skin) => !skin.isDefault)
  const selected = skins.find((skin) => skin.id === value)
  return (
    <Field>
      <FieldLabel htmlFor="target-skin">Trang phục nhận ảnh</FieldLabel>
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <Button
            id="target-skin"
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-auto min-h-9 justify-between font-normal"
          >
            {selected ? (
              <span className="flex min-w-0 items-center gap-2">
                <MediaImage path={selected.portrait} className="h-8 w-5 rounded-sm object-cover" />
                <span className="truncate">{selected.name || "Chưa có tên"}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Chọn trang phục của {hero.name}…</span>
            )}
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
          <Command filter={commandFilter}>
            <CommandInput placeholder="Gõ tên trang phục…" />
            <CommandList>
              <CommandEmpty>Không có trang phục phù hợp.</CommandEmpty>
              <CommandGroup>
                {skins.map((skin) => (
                  <CommandItem
                    key={skin.id}
                    value={`${skin.name} ${skin.sourceSkinId}`}
                    onSelect={() => {
                      onChange(skin.id)
                      setOpen(false)
                    }}
                  >
                    <Check className={cn(value === skin.id ? "opacity-100" : "opacity-0")} />
                    <MediaImage path={skin.portrait} className="h-8 w-5 rounded-sm object-cover" />
                    <span className="truncate">{skin.name || "Chưa có tên"}</span>
                    {!skin.portrait && (
                      <Badge variant="destructive" className="ml-auto">
                        Thiếu
                      </Badge>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </Field>
  )
}
