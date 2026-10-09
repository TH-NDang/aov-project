import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ExternalLink, TriangleAlert, WrapText } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@aov/ui/components/alert"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@aov/ui/components/field"
import { Input } from "@aov/ui/components/input"
import { NativeSelect, NativeSelectOption } from "@aov/ui/components/native-select"
import { Separator } from "@aov/ui/components/separator"
import { Spinner } from "@aov/ui/components/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@aov/ui/components/table"
import { Textarea } from "@aov/ui/components/textarea"
import type { Enchantment, EnchantmentGroup } from "@/lib/api/types"
import { CopyButton } from "@/components/copy-button"
import { MediaImage } from "@/components/media-image"
import { forEachFieldError } from "@/lib/api/errors"
import { useUpdateEnchantment } from "@/lib/queries"

const schema = z.object({
  name: z.string().trim().min(1, "Tên không được để trống."),
  summary: z.string().trim(),
  description: z.string().trim().min(1, "Mô tả không được để trống."),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  column: z.number({ error: "Cột phải là số." }).int("Cột phải là số nguyên.").min(0, "Cột không được âm."),
})
type EnchantmentForm = z.infer<typeof schema>

const TIER_LABEL = { 1: "I", 2: "II", 3: "III" } as const

const toForm = (item: Enchantment): EnchantmentForm => ({
  name: item.name,
  summary: item.summary,
  description: item.description,
  tier: item.tier,
  column: item.position.column,
})

/** Joins lines broken by the narrow Excel column, keeping blank-line paragraph breaks. */
export const unwrapLines = (text: string) => text.replace(/([^\n])\n(?!\n)/g, "$1 ").replace(/ {2,}/g, " ")

export function EnchantmentEditor({ item, group }: { item: Enchantment; group: EnchantmentGroup | undefined }) {
  const update = useUpdateEnchantment()
  const { register, handleSubmit, reset, setValue, getValues, setError, formState } = useForm<EnchantmentForm>({
    resolver: zodResolver(schema),
    defaultValues: toForm(item),
  })
  useEffect(() => reset(toForm(item)), [item, reset])

  const onSubmit = handleSubmit((values) =>
    update.mutate(
      { id: item.id, input: { expectedVersion: item.version, ...values } },
      {
        onSuccess: (saved) => toast.success(`Đã lưu phù hiệu “${saved.name}” (v${saved.version}).`),
        onError: (error) =>
          forEachFieldError(error, (path, message) => {
            if (path in schema.shape) setError(path as keyof EnchantmentForm, { message })
          }),
      },
    ),
  )

  const website = item.websitePosition
  const websiteDiffers = website && (website.row !== item.position.row || website.column !== item.position.column)
  const error = (key: keyof EnchantmentForm) => formState.errors[key]

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5 p-5">
      <div className="flex items-start gap-4 pr-8">
        <MediaImage
          path={item.image.file}
          alt={item.name}
          className="size-16 shrink-0 rounded-lg border bg-muted/40 object-contain p-1"
        />
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm text-muted-foreground">{group?.name}</p>
          <h2 className="text-xl font-semibold">{item.name}</h2>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">Cấp {item.tierLabel}</Badge>
            <Badge variant="outline">
              Hàng {item.position.row} · Cột {item.position.column}
            </Badge>
            <Badge variant="outline" className="font-mono">
              v{item.version}
            </Badge>
          </div>
        </div>
      </div>

      {websiteDiffers && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Vị trí trên web Garena khác Excel</AlertTitle>
          <AlertDescription>
            Web: hàng {website.row}, cột {website.column}. Thứ tự trên web không nhất thiết giống bố cục trong game; dữ
            liệu đang theo Excel.
          </AlertDescription>
        </Alert>
      )}

      <FieldGroup className="gap-4">
        <Field data-invalid={!!error("name")}>
          <FieldLabel htmlFor="ench-name">Tên</FieldLabel>
          <Input id="ench-name" autoComplete="off" aria-invalid={!!error("name")} {...register("name")} />
          <FieldError errors={[error("name")]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="ench-summary">Tóm tắt</FieldLabel>
          <Input id="ench-summary" autoComplete="off" {...register("summary")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="ench-tier">Cấp (hàng)</FieldLabel>
            <NativeSelect id="ench-tier" {...register("tier", { setValueAs: (value) => Number(value) })}>
              {([1, 2, 3] as const).map((tier) => (
                <NativeSelectOption key={tier} value={tier}>
                  Cấp {TIER_LABEL[tier]} · hàng {tier - 1}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field data-invalid={!!error("column")}>
            <FieldLabel htmlFor="ench-column">Cột</FieldLabel>
            <Input
              id="ench-column"
              type="number"
              min={0}
              aria-invalid={!!error("column")}
              {...register("column", { valueAsNumber: true })}
            />
            <FieldError errors={[error("column")]} />
          </Field>
        </div>
        <Field data-invalid={!!error("description")}>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor="ench-description">Mô tả</FieldLabel>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setValue("description", unwrapLines(getValues("description")), { shouldDirty: true })}
            >
              <WrapText /> Nối dòng bị ngắt
            </Button>
          </div>
          <Textarea id="ench-description" rows={8} aria-invalid={!!error("description")} {...register("description")} />
          <FieldDescription>
            Excel ngắt dòng theo độ rộng cột; dùng “Nối dòng bị ngắt” để gộp thành đoạn.
          </FieldDescription>
          <FieldError errors={[error("description")]} />
        </Field>
      </FieldGroup>

      <Separator />
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Ảnh</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
          <dt className="text-muted-foreground">File</dt>
          <dd className="flex min-w-0 items-center gap-1 font-mono">
            <span className="truncate">{item.image.file}</span>
            <CopyButton value={item.image.file} />
          </dd>
          {item.image.width && (
            <>
              <dt className="text-muted-foreground">Kích thước</dt>
              <dd>
                {item.image.width}×{item.image.height}
              </dd>
            </>
          )}
          {item.image.sha256 && (
            <>
              <dt className="text-muted-foreground">SHA-256</dt>
              <dd className="flex items-center gap-1 font-mono">
                {item.image.sha256.slice(0, 16)}…
                <CopyButton value={item.image.sha256} />
              </dd>
            </>
          )}
          {item.image.sourceUrl && (
            <>
              <dt className="text-muted-foreground">Nguồn</dt>
              <dd>
                <a
                  href={item.image.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline underline-offset-4"
                >
                  Garena <ExternalLink className="size-3" />
                </a>
              </dd>
            </>
          )}
        </dl>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">
          Dòng gốc trong Excel · {item.source.sheet}, dòng {item.source.row}
        </h3>
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Cột</TableHead>
                <TableHead>Giá trị</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(item.source.raw).map(([column, value]) => (
                <TableRow key={column}>
                  <TableCell className="font-mono text-xs">{column}</TableCell>
                  <TableCell className="text-xs whitespace-pre-line">{value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-5 -mb-5 flex items-center justify-end gap-2 border-t bg-background/95 px-5 py-3 backdrop-blur">
        {formState.isDirty && <span className="mr-auto text-xs text-muted-foreground">Có thay đổi chưa lưu</span>}
        <Button type="button" variant="ghost" disabled={!formState.isDirty || update.isPending} onClick={() => reset()}>
          Bỏ thay đổi
        </Button>
        <Button type="submit" disabled={!formState.isDirty || update.isPending}>
          {update.isPending && <Spinner />} Lưu phù hiệu
        </Button>
      </div>
    </form>
  )
}
