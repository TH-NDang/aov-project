import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { Film } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aov/ui/components/card"
import { Field, FieldError, FieldLabel } from "@aov/ui/components/field"
import { Input } from "@aov/ui/components/input"
import { Spinner } from "@aov/ui/components/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@aov/ui/components/table"
import { Textarea } from "@aov/ui/components/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"
import type { Hero, Skill } from "@/lib/api/types"
import { MediaImage } from "@/components/media-image"
import { useUpdateHeroSkills } from "@/lib/queries"

interface SkillsForm {
  skills: { slot: number; name: string; description: string }[]
}

const SWITCH_LABEL: Record<Skill["switchMode"], string | null> = {
  none: null,
  "skill-variant": "Biến thể chiêu",
  "hero-form": "Theo dạng tướng",
}

const slotLabel = (slot: number) => (slot === 0 ? "Nội tại" : `Chiêu ${slot}`)
const toForm = (hero: Hero): SkillsForm => ({
  skills: hero.skills.map((skill) => ({ slot: skill.slot, name: skill.name, description: skill.description ?? "" })),
})

export function HeroSkillsForm({ hero }: { hero: Hero }) {
  const update = useUpdateHeroSkills(hero.id)
  const { register, handleSubmit, reset, formState } = useForm<SkillsForm>({ defaultValues: toForm(hero) })

  useEffect(() => reset(toForm(hero)), [hero, reset])

  const onSubmit = handleSubmit((values) =>
    update.mutate(
      { expectedVersion: hero.version, skills: values.skills },
      { onSuccess: () => toast.success(`Đã lưu kỹ năng của ${hero.name}.`) },
    ),
  )

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      {hero.forms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dạng tướng</CardTitle>
            <CardDescription>
              {hero.formLabelNote ?? "Mỗi dạng dùng một bộ icon riêng cho từng ô kỹ năng."}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dạng</TableHead>
                  {hero.skills.map((skill) => (
                    <TableHead key={skill.slot} className="text-center">
                      {slotLabel(skill.slot)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {hero.forms.map((form) => (
                  <TableRow key={form.id}>
                    <TableCell className="font-medium">{form.name}</TableCell>
                    {hero.skills.map((skill) => {
                      const variant = skill.variants.find(
                        (candidate) => candidate.index === form.variantBySlot[String(skill.slot)],
                      )
                      return (
                        <TableCell key={skill.slot} className="text-center">
                          <MediaImage path={variant?.icon} className="mx-auto size-9 rounded-md object-cover" />
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {hero.skills.map((skill, position) => {
          const error = formState.errors.skills?.[position]?.name
          return (
            <Card key={skill.slot} className="gap-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {slotLabel(skill.slot)}
                  {SWITCH_LABEL[skill.switchMode] && <Badge variant="outline">{SWITCH_LABEL[skill.switchMode]}</Badge>}
                </CardTitle>
                <CardDescription>{skill.variants.length} icon</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {skill.variants.map((variant) => (
                    <Tooltip key={variant.index}>
                      <TooltipTrigger asChild>
                        <div className="relative">
                          <MediaImage
                            path={variant.icon}
                            alt={`${skill.name} ${variant.index}`}
                            className="size-12 rounded-lg border object-cover"
                          />
                          {skill.variants.length > 1 && (
                            <span className="absolute -right-1 -bottom-1 rounded-full border bg-background px-1 text-[10px] font-medium">
                              {variant.index}
                            </span>
                          )}
                          {variant.video && (
                            <Film className="absolute -top-1 -right-1 size-4 rounded-full bg-background p-0.5" />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-80 break-all">
                        {variant.sourceUrl ?? variant.icon}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
                <input type="hidden" {...register(`skills.${position}.slot`, { valueAsNumber: true })} />
                <Field data-invalid={!!error}>
                  <FieldLabel htmlFor={`skill-${skill.slot}-name`}>Tên kỹ năng</FieldLabel>
                  <Input
                    id={`skill-${skill.slot}-name`}
                    autoComplete="off"
                    aria-invalid={!!error}
                    {...register(`skills.${position}.name`, {
                      validate: (value) => value.trim() !== "" || "Tên không được để trống.",
                    })}
                  />
                  <FieldError errors={[error]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`skill-${skill.slot}-description`}>Mô tả</FieldLabel>
                  <Textarea
                    id={`skill-${skill.slot}-description`}
                    rows={3}
                    placeholder="Chưa có mô tả. Nhập hiệu ứng, hồi chiêu, tỉ lệ sát thương…"
                    {...register(`skills.${position}.description`)}
                  />
                </Field>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        {formState.isDirty && <span className="mr-auto text-xs text-muted-foreground">Có thay đổi chưa lưu</span>}
        <Button type="button" variant="ghost" disabled={!formState.isDirty || update.isPending} onClick={() => reset()}>
          Bỏ thay đổi
        </Button>
        <Button type="submit" disabled={!formState.isDirty || update.isPending}>
          {update.isPending && <Spinner />} Lưu kỹ năng
        </Button>
      </div>
    </form>
  )
}
