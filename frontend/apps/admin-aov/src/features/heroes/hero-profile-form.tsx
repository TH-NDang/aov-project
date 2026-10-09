import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { History } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@aov/ui/components/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@aov/ui/components/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@aov/ui/components/field"
import { Input } from "@aov/ui/components/input"
import { Spinner } from "@aov/ui/components/spinner"
import type { Hero } from "@/lib/api/types"
import { forEachFieldError } from "@/lib/api/errors"
import { useAudit, useUpdateHeroProfile } from "@/lib/queries"
import { formatRelative } from "@/lib/text"

const optionalUrl = z
  .string()
  .trim()
  .refine((value) => value === "" || /^https?:\/\/\S+$/.test(value), "Cần là đường dẫn http(s) hợp lệ.")

const schema = z.object({
  name: z.string().trim().min(1, "Tên tướng không được để trống.").max(80, "Tối đa 80 ký tự."),
  portraits: optionalUrl,
  skills: optionalUrl,
})
type ProfileForm = z.infer<typeof schema>

const toForm = (hero: Hero): ProfileForm => ({
  name: hero.name,
  portraits: hero.sources.portraits ?? "",
  skills: hero.sources.skills ?? "",
})

export function HeroProfileForm({ hero }: { hero: Hero }) {
  const update = useUpdateHeroProfile(hero.id)
  const audit = useAudit()
  const { register, handleSubmit, reset, setError, formState } = useForm<ProfileForm>({
    resolver: zodResolver(schema),
    defaultValues: toForm(hero),
  })

  useEffect(() => reset(toForm(hero)), [hero, reset])

  const onSubmit = handleSubmit((values) =>
    update.mutate(
      {
        expectedVersion: hero.version,
        name: values.name,
        sources: { portraits: values.portraits || undefined, skills: values.skills || undefined },
      },
      {
        onSuccess: (saved) => toast.success(`Đã lưu thông tin ${saved.name} (v${saved.version}).`),
        onError: (error) =>
          forEachFieldError(error, (path, message) => path === "name" && setError("name", { message })),
      },
    ),
  )

  const history = (audit.data ?? []).filter(
    (entry) => entry.entityId === hero.id || entry.entityId.startsWith(`${hero.id}-`),
  )

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <form noValidate onSubmit={onSubmit} className="contents">
          <CardHeader>
            <CardTitle>Thông tin chung</CardTitle>
            <CardDescription>Tên hiển thị có thể đổi; mã tướng là định danh ổn định và không đổi.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!formState.errors.name}>
                <FieldLabel htmlFor="hero-name">Tên hiển thị</FieldLabel>
                <Input id="hero-name" autoComplete="off" aria-invalid={!!formState.errors.name} {...register("name")} />
                <FieldError errors={[formState.errors.name]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="hero-code">Mã tướng</FieldLabel>
                <Input id="hero-code" value={hero.id} readOnly disabled className="font-mono" />
                <FieldDescription>Dùng trong URL và tham chiếu từ giải đấu/cộng đồng.</FieldDescription>
              </Field>
              <Field data-invalid={!!formState.errors.portraits}>
                <FieldLabel htmlFor="hero-source-portraits">Nguồn ảnh (Garena)</FieldLabel>
                <Input
                  id="hero-source-portraits"
                  type="url"
                  placeholder="https://lienquan.garena.vn/…"
                  aria-invalid={!!formState.errors.portraits}
                  {...register("portraits")}
                />
                <FieldError errors={[formState.errors.portraits]} />
              </Field>
              <Field data-invalid={!!formState.errors.skills}>
                <FieldLabel htmlFor="hero-source-skills">Nguồn kỹ năng (Liquipedia)</FieldLabel>
                <Input
                  id="hero-source-skills"
                  type="url"
                  placeholder="https://liquipedia.net/…"
                  aria-invalid={!!formState.errors.skills}
                  {...register("skills")}
                />
                <FieldError errors={[formState.errors.skills]} />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end gap-2 border-t">
            {formState.isDirty && <span className="mr-auto text-xs text-muted-foreground">Có thay đổi chưa lưu</span>}
            <Button
              type="button"
              variant="ghost"
              disabled={!formState.isDirty || update.isPending}
              onClick={() => reset()}
            >
              Bỏ thay đổi
            </Button>
            <Button type="submit" disabled={!formState.isDirty || update.isPending}>
              {update.isPending && <Spinner />} Lưu thông tin
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lịch sử chỉnh sửa</CardTitle>
          <CardDescription>Phiên bản hiện tại: v{hero.version}</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length ? (
            <ol className="space-y-3">
              {history.slice(0, 10).map((entry) => (
                <li key={entry.id} className="flex gap-3 text-sm">
                  <History className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate">
                      {entry.action} · <span className="text-muted-foreground">{entry.label}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{formatRelative(entry.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có chỉnh sửa nào cho tướng này.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
