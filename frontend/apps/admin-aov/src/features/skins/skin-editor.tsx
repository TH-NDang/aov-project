import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link } from "react-router"
import { Star } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@aov/ui/components/field"
import { Input } from "@aov/ui/components/input"
import { Separator } from "@aov/ui/components/separator"
import { Spinner } from "@aov/ui/components/spinner"
import { cn } from "@aov/ui/lib/utils"
import type { Hero, Skin, SkinBadge } from "@/lib/api/types"
import { BadgePicker } from "@/components/badge-picker"
import { CopyButton } from "@/components/copy-button"
import { MediaImage } from "@/components/media-image"
import { isPortraitOnly } from "@/lib/domain/portraits"
import { fileName } from "@/lib/media"
import { useUpdateSkin } from "@/lib/queries"
import { formatDateTime } from "@/lib/text"

const schema = z.object({
  name: z.string().trim().min(1, "Tên không được để trống.").max(120, "Tối đa 120 ký tự."),
  badgeId: z.string().nullable(),
  portrait: z.string().nullable(),
})
type SkinForm = z.infer<typeof schema>

export function SkinFlags({ skin }: { skin: Skin }) {
  return (
    <div className="flex flex-wrap gap-1">
      {skin.isDefault && <Badge variant="secondary">Mặc định</Badge>}
      {isPortraitOnly(skin) && <Badge variant="outline">Chỉ portrait</Badge>}
      {!skin.portrait && <Badge variant="destructive">Thiếu portrait</Badge>}
      {skin.portraitAlternates.length > 0 && <Badge variant="outline">{skin.portraitAlternates.length} bản khác</Badge>}
    </div>
  )
}

interface SkinEditorProps {
  hero: Hero
  skin: Skin
  badges: SkinBadge[]
  badgeUsage?: Map<string, number>
  showHeroLink?: boolean
}

/** Edits a skin's name, tier badge and primary portrait. */
export function SkinEditor({ hero, skin, badges, badgeUsage, showHeroLink }: SkinEditorProps) {
  const update = useUpdateSkin()
  const form = useForm<SkinForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: skin.name, badgeId: skin.badgeId, portrait: skin.portrait },
  })
  const { register, control, handleSubmit, reset, watch, formState } = form

  useEffect(() => {
    reset({ name: skin.name, badgeId: skin.badgeId, portrait: skin.portrait })
  }, [skin, reset])

  const versions = [skin.portrait, ...skin.portraitAlternates].filter((file): file is string => !!file)
  const selectedPortrait = watch("portrait")
  const badge = badges.find((candidate) => candidate.id === watch("badgeId"))

  const onSubmit = handleSubmit((values) =>
    update.mutate(
      { heroId: hero.id, skinId: skin.id, input: { expectedVersion: hero.version, ...values } },
      { onSuccess: () => toast.success(`Đã lưu trang phục “${values.name}”.`) },
    ),
  )

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5 p-5">
      <div className="space-y-2 pr-8">
        <p className="text-sm text-muted-foreground">
          {showHeroLink ? (
            <Link to={`/heroes/${hero.id}?tab=skins`} className="underline-offset-4 hover:underline">
              {hero.name}
            </Link>
          ) : (
            hero.name
          )}
        </p>
        <h2 className="text-xl font-semibold">{skin.name || "Chưa có tên"}</h2>
        <SkinFlags skin={skin} />
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,180px)_1fr]">
        <div className="relative overflow-hidden rounded-lg border bg-muted/40">
          <MediaImage
            path={selectedPortrait}
            alt={skin.name}
            className="aspect-[278/436] w-full object-cover"
            fallbackClassName="aspect-[278/436] w-full"
          />
          {badge && (
            <MediaImage
              path={badge.icon}
              className="absolute bottom-2 left-1/2 h-7 w-auto -translate-x-1/2 drop-shadow"
            />
          )}
        </div>
        <FieldGroup className="gap-4">
          <Field data-invalid={!!formState.errors.name}>
            <FieldLabel htmlFor={`skin-name-${skin.id}`}>Tên hiển thị</FieldLabel>
            <Input
              id={`skin-name-${skin.id}`}
              autoComplete="off"
              aria-invalid={!!formState.errors.name}
              {...register("name")}
            />
            <FieldDescription>
              Tên đầy đủ: {hero.name} {watch("name")}
            </FieldDescription>
            <FieldError errors={[formState.errors.name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`skin-badge-${skin.id}`}>Bậc trang phục</FieldLabel>
            <Controller
              control={control}
              name="badgeId"
              render={({ field }) => (
                <BadgePicker
                  id={`skin-badge-${skin.id}`}
                  badges={badges}
                  value={field.value}
                  onChange={field.onChange}
                  usage={badgeUsage}
                />
              )}
            />
          </Field>
        </FieldGroup>
      </div>

      <FieldSet>
        <FieldLegend variant="label">Ảnh chính</FieldLegend>
        <FieldDescription>
          Bấm một bản để làm ảnh chính; ảnh chính cũ chuyển thành bản khác. Muốn chuyển ảnh sang trang phục khác, dùng
          trang{" "}
          <Link to="/portraits" className="underline underline-offset-4">
            Portrait
          </Link>
          .
        </FieldDescription>
        {versions.length ? (
          <Controller
            control={control}
            name="portrait"
            render={({ field }) => (
              <div role="radiogroup" aria-label="Ảnh chính" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {versions.map((file) => {
                  const active = field.value === file
                  return (
                    <button
                      key={file}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      title={file}
                      onClick={() => field.onChange(file)}
                      className={cn(
                        "relative overflow-hidden rounded-md border bg-muted/40 text-left transition-shadow outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        active && "ring-2 ring-primary",
                      )}
                    >
                      <MediaImage
                        path={file}
                        className="aspect-[278/436] w-full object-cover"
                        fallbackClassName="aspect-[278/436] w-full"
                      />
                      {file === skin.portrait && (
                        <span className="absolute top-1 left-1 flex items-center gap-1 rounded bg-background/90 px-1 text-[10px] font-medium">
                          <Star className="size-3" /> Hiện tại
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          />
        ) : (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Chưa có portrait. Ghép ảnh trong trang{" "}
            <Link to="/portraits?tab=unmatched" className="underline underline-offset-4">
              Portrait
            </Link>
            .
          </p>
        )}
      </FieldSet>

      <div className="grid grid-cols-2 gap-3">
        {(["head", "cover"] as const).map((role) => (
          <div key={role} className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase">{role}</p>
            <MediaImage
              path={skin[role]}
              alt={`${skin.name} ${role}`}
              className="aspect-video w-full rounded-md border object-cover"
              fallbackClassName="aspect-video w-full rounded-md border"
            />
          </div>
        ))}
      </div>

      <Separator />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        <dt className="text-muted-foreground">Mã</dt>
        <dd className="flex min-w-0 items-center gap-1 font-mono">
          <span className="truncate">{skin.id}</span>
          <CopyButton value={skin.id} />
        </dd>
        <dt className="text-muted-foreground">Mã nguồn</dt>
        <dd className="font-mono">{skin.sourceSkinId}</dd>
        {skin.portrait && (
          <>
            <dt className="text-muted-foreground">File</dt>
            <dd className="truncate font-mono">{skin.portraitFileName ?? fileName(skin.portrait)}</dd>
          </>
        )}
        {skin.createdAt && (
          <>
            <dt className="text-muted-foreground">Tạo lúc</dt>
            <dd>{formatDateTime(skin.createdAt)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Phiên bản</dt>
        <dd>v{hero.version} (dữ liệu tướng)</dd>
      </dl>

      <div className="sticky bottom-0 -mx-5 -mb-5 flex items-center justify-end gap-2 border-t bg-background/95 px-5 py-3 backdrop-blur">
        {formState.isDirty && <span className="mr-auto text-xs text-muted-foreground">Có thay đổi chưa lưu</span>}
        <Button type="button" variant="ghost" disabled={!formState.isDirty || update.isPending} onClick={() => reset()}>
          Bỏ thay đổi
        </Button>
        <Button type="submit" disabled={!formState.isDirty || update.isPending}>
          {update.isPending && <Spinner />} Lưu trang phục
        </Button>
      </div>
    </form>
  )
}
