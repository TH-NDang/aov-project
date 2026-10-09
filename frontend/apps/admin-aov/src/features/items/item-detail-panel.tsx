import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowUpRight, Minus, Plus, Trash2, TriangleAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@aov/ui/components/alert"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { ButtonGroup } from "@aov/ui/components/button-group"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@aov/ui/components/field"
import { Input } from "@aov/ui/components/input"
import { NativeSelect, NativeSelectOption } from "@aov/ui/components/native-select"
import { Separator } from "@aov/ui/components/separator"
import { Textarea } from "@aov/ui/components/textarea"
import { cn } from "@aov/ui/lib/utils"
import type { Item, ItemCategory, ItemIssue, RecipeComponent, RecipeStatus } from "@/lib/api/types"
import { MediaImage } from "@/components/media-image"
import {
  buildsInto,
  componentsCost,
  ISSUE_LABEL,
  RECIPE_STATUS_LABEL,
  recipeTree,
  SUPPORT_GROUP,
  SUPPORT_VARIANTS,
  validateCatalog,
  type RecipeNode,
} from "@/lib/domain/items"
import { formatNumber } from "@/lib/text"
import { ItemPicker } from "./item-picker"
import type { ItemWorkspace } from "./use-item-workspace"

const infoSchema = z.object({
  name: z.string().trim().min(1, "Tên không được để trống."),
  price: z.number({ error: "Giá phải là số." }).int("Giá phải là số nguyên.").min(0, "Giá không được âm."),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  category: z.string().min(1),
  summary: z.string().trim(),
  description: z.string(),
})
type InfoForm = z.infer<typeof infoSchema>

const toInfo = (item: Item): InfoForm => ({
  name: item.name,
  price: item.price,
  tier: item.tier,
  category: item.category,
  summary: item.summary,
  description: item.description,
})

export function RecipeStatusBadge({ status }: { status: RecipeStatus }) {
  return (
    <Badge variant={status === "verified" ? "secondary" : status === "unverified" ? "destructive" : "outline"}>
      {RECIPE_STATUS_LABEL[status]}
    </Badge>
  )
}

interface ItemDetailPanelProps {
  item: Item
  workspace: ItemWorkspace
  categories: ItemCategory[]
  issues: ItemIssue[]
  onSelect: (itemId: string) => void
}

export function ItemDetailPanel({ item, workspace, categories, issues, onSelect }: ItemDetailPanelProps) {
  const items = workspace.items
  const byId = useMemo(() => new Map(items.map((candidate) => [candidate.id, candidate])), [items])
  const upgrades = buildsInto(items, item.id)
  const tree = recipeTree(items, item.id)
  const itemProblems = workspace.problems.filter((problem) => problem.itemId === item.id)

  return (
    <div className="space-y-6 p-5">
      <div className="flex items-start gap-4 pr-8">
        <MediaImage
          path={item.image}
          alt={item.name}
          className="size-16 shrink-0 rounded-lg border bg-muted/40 object-contain p-1"
        />
        <div className="min-w-0 space-y-1.5">
          <h2 className="text-xl font-semibold">{item.name}</h2>
          <p className="font-mono text-xs text-muted-foreground">{item.id}</p>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">{item.category}</Badge>
            <Badge variant="outline">Cấp {item.tier}</Badge>
            <Badge variant="outline">{formatNumber(item.price)} vàng</Badge>
            <RecipeStatusBadge status={item.recipe.status} />
            {workspace.changed.has(item.id) && <Badge>Đã sửa · chưa lưu</Badge>}
          </div>
        </div>
      </div>

      {itemProblems.length > 0 && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Dữ liệu chưa hợp lệ</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {itemProblems.map((problem) => (
                <li key={problem.message}>{problem.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {issues.map((issue) => (
        <Alert key={issue.id}>
          <TriangleAlert />
          <AlertTitle>
            {ISSUE_LABEL[issue.code]}{" "}
            {issue.excelCell && <span className="font-mono text-xs text-muted-foreground">· ô {issue.excelCell}</span>}
          </AlertTitle>
          <AlertDescription>
            <p>{issue.message}</p>
            {issue.excelLevel !== undefined && (
              <p>
                Excel: cấp {issue.excelLevel} · Garena: cấp {issue.garenaLevel}
              </p>
            )}
            {issue.itemIds.length > 1 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {issue.itemIds
                  .filter((id) => id !== item.id)
                  .map((id) => (
                    <Button key={id} variant="outline" size="xs" onClick={() => onSelect(id)}>
                      {byId.get(id)?.name ?? id}
                    </Button>
                  ))}
              </div>
            )}
          </AlertDescription>
        </Alert>
      ))}

      <InfoSection item={item} workspace={workspace} categories={categories} />
      <Separator />
      <PositionsSection item={item} workspace={workspace} categories={categories} />
      <Separator />
      <RecipeSection item={item} workspace={workspace} categories={categories} />

      {tree && tree.children.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-semibold">Cây công thức</h3>
          <ul className="space-y-1 text-sm">
            <RecipeTreeNode node={tree} onSelect={onSelect} root />
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="font-semibold">Nâng cấp thành</h3>
        {upgrades.length ? (
          <div className="flex flex-wrap gap-2">
            {upgrades.map((upgrade) => (
              <Button key={upgrade.id} variant="outline" size="sm" onClick={() => onSelect(upgrade.id)}>
                <MediaImage path={upgrade.image} className="size-5 object-contain" />
                {upgrade.name}
                <ArrowUpRight className="opacity-50" />
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Chưa có công thức đã xác nhận nào dùng món này.</p>
        )}
        {items.some((candidate) => candidate.recipe.status === "unverified") && (
          <p className="text-xs text-muted-foreground">Danh sách có thể chưa đầy đủ vì còn công thức chưa xác nhận.</p>
        )}
      </section>
    </div>
  )
}

function InfoSection({
  item,
  workspace,
  categories,
}: {
  item: Item
  workspace: ItemWorkspace
  categories: ItemCategory[]
}) {
  const { register, handleSubmit, reset, formState } = useForm<InfoForm>({
    resolver: zodResolver(infoSchema),
    defaultValues: toInfo(item),
  })
  const signature = JSON.stringify(toInfo(item))
  useEffect(() => reset(JSON.parse(signature) as InfoForm), [signature, reset])

  const onSubmit = handleSubmit((values) => workspace.updateItem(item.id, (draft) => Object.assign(draft, values)))
  const error = (key: keyof InfoForm) => formState.errors[key]

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      <h3 className="font-semibold">Thông tin</h3>
      <FieldGroup className="gap-4">
        <Field data-invalid={!!error("name")}>
          <FieldLabel htmlFor="item-name">Tên</FieldLabel>
          <Input id="item-name" autoComplete="off" aria-invalid={!!error("name")} {...register("name")} />
          <FieldError errors={[error("name")]} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field data-invalid={!!error("price")}>
            <FieldLabel htmlFor="item-price">Giá</FieldLabel>
            <Input
              id="item-price"
              type="number"
              min={0}
              step={1}
              aria-invalid={!!error("price")}
              {...register("price", { valueAsNumber: true })}
            />
            <FieldError errors={[error("price")]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="item-tier">Cấp</FieldLabel>
            <NativeSelect id="item-tier" {...register("tier", { setValueAs: (value) => Number(value) })}>
              {[1, 2, 3].map((tier) => (
                <NativeSelectOption key={tier} value={tier}>
                  Cấp {tier}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="item-category">Nhóm</FieldLabel>
            <NativeSelect id="item-category" {...register("category")}>
              {categories.map((category) => (
                <NativeSelectOption key={category.id} value={category.name}>
                  {category.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="item-summary">Tóm tắt</FieldLabel>
          <Input id="item-summary" autoComplete="off" {...register("summary")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="item-description">Mô tả</FieldLabel>
          <Textarea id="item-description" rows={5} className="font-mono text-xs" {...register("description")} />
          <FieldDescription>Giữ nguyên định dạng nguồn Excel (gồm dấu ngoặc kép và xuống dòng).</FieldDescription>
        </Field>
      </FieldGroup>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={!formState.isDirty} onClick={() => reset()}>
          Hoàn lại
        </Button>
        <Button type="submit" size="sm" variant="secondary" disabled={!formState.isDirty}>
          Áp dụng thông tin
        </Button>
      </div>
    </form>
  )
}

function PositionsSection({
  item,
  workspace,
  categories,
}: {
  item: Item
  workspace: ItemWorkspace
  categories: ItemCategory[]
}) {
  const setPosition = (index: number, changes: Partial<Item["shopPositions"][number]>) =>
    workspace.updateItem(item.id, (draft) => Object.assign(draft.shopPositions[index], changes))
  const toIndex = (value: string) => (value === "" ? null : Math.max(0, Math.floor(Number(value))))

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Vị trí trong shop</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            workspace.updateItem(item.id, (draft) =>
              draft.shopPositions.push({ group: draft.category, row: null, column: null, variant: null }),
            )
          }
        >
          <Plus /> Thêm vị trí
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Hàng và cột bắt đầu từ 0. Để trống nghĩa là chưa có dữ liệu, không phải vị trí 0.
      </p>
      {item.shopPositions.map((position, index) => (
        <div key={index} className="grid grid-cols-[1fr_4.5rem_4.5rem_auto] items-end gap-2 rounded-md border p-3">
          <Field>
            <FieldLabel htmlFor={`pos-${index}-group`} className="text-xs">
              Nhóm
            </FieldLabel>
            <NativeSelect
              id={`pos-${index}-group`}
              value={position.group}
              onChange={(event) => setPosition(index, { group: event.target.value })}
            >
              {categories.map((category) => (
                <NativeSelectOption key={category.id} value={category.name}>
                  {category.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor={`pos-${index}-row`} className="text-xs">
              Hàng
            </FieldLabel>
            <Input
              id={`pos-${index}-row`}
              type="number"
              min={0}
              value={position.row ?? ""}
              onChange={(event) => setPosition(index, { row: toIndex(event.target.value) })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`pos-${index}-col`} className="text-xs">
              Cột
            </FieldLabel>
            <Input
              id={`pos-${index}-col`}
              type="number"
              min={0}
              value={position.column ?? ""}
              onChange={(event) => setPosition(index, { column: toIndex(event.target.value) })}
            />
          </Field>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Xoá vị trí"
            disabled={item.shopPositions.length === 1}
            onClick={() => workspace.updateItem(item.id, (draft) => draft.shopPositions.splice(index, 1))}
          >
            <Trash2 />
          </Button>
          {position.group === SUPPORT_GROUP && (
            <Field className="col-span-full">
              <FieldLabel htmlFor={`pos-${index}-variant`} className="text-xs">
                Nhánh phụ trợ
              </FieldLabel>
              <NativeSelect
                id={`pos-${index}-variant`}
                value={position.variant ?? ""}
                onChange={(event) => setPosition(index, { variant: event.target.value || null })}
              >
                <NativeSelectOption value="">Dùng chung</NativeSelectOption>
                {SUPPORT_VARIANTS.map((variant) => (
                  <NativeSelectOption key={variant} value={variant}>
                    {variant}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
        </div>
      ))}
    </section>
  )
}

function RecipeSection({
  item,
  workspace,
  categories,
}: {
  item: Item
  workspace: ItemWorkspace
  categories: ItemCategory[]
}) {
  const signature = JSON.stringify(item.recipe)
  const [status, setStatus] = useState<RecipeStatus>(item.recipe.status)
  const [components, setComponents] = useState<RecipeComponent[]>(item.recipe.components)

  useEffect(() => {
    const recipe = JSON.parse(signature) as Item["recipe"]
    setStatus(recipe.status)
    setComponents(recipe.components)
  }, [signature])

  const dirty = JSON.stringify({ status, components }) !== signature
  const byId = new Map(workspace.items.map((candidate) => [candidate.id, candidate]))
  const total = componentsCost(workspace.items, components)
  const fee = item.price - total
  const draftProblems = useMemo(() => {
    const candidate = workspace.items.map((other) =>
      other.id === item.id ? { ...other, recipe: { status, components } } : other,
    )
    // Only recipe problems matter here; cycles are reported on whichever item closes the loop.
    return validateCatalog({ categories, items: candidate })
      .filter((problem) => (problem.kind === "recipe" && problem.itemId === item.id) || problem.kind === "cycle")
      .map((problem) => problem.message)
  }, [workspace.items, item.id, status, components, categories])

  const setQuantity = (index: number, quantity: number) =>
    setComponents((current) =>
      current.map((component, position) =>
        position === index ? { ...component, quantity: Math.max(1, quantity) } : component,
      ),
    )

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Công thức ghép</h3>
        <NativeSelect
          aria-label="Trạng thái công thức"
          size="sm"
          value={status}
          onChange={(event) => setStatus(event.target.value as RecipeStatus)}
        >
          {(Object.keys(RECIPE_STATUS_LABEL) as RecipeStatus[]).map((value) => (
            <NativeSelectOption key={value} value={value}>
              {RECIPE_STATUS_LABEL[value]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {components.length ? (
        <ul className="divide-y rounded-md border">
          {components.map((component, index) => {
            const source = byId.get(component.itemId)
            return (
              <li key={component.itemId} className="flex items-center gap-3 px-3 py-2">
                <MediaImage path={source?.image} className="size-8 rounded-sm object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{source?.name ?? component.itemId}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatNumber(source?.price ?? 0)} × {component.quantity} ={" "}
                    {formatNumber((source?.price ?? 0) * component.quantity)}
                  </p>
                </div>
                <ButtonGroup aria-label="Số lượng">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Giảm"
                    disabled={component.quantity <= 1}
                    onClick={() => setQuantity(index, component.quantity - 1)}
                  >
                    <Minus />
                  </Button>
                  <Input
                    aria-label="Số lượng"
                    type="number"
                    min={1}
                    value={component.quantity}
                    onChange={(event) => setQuantity(index, Math.floor(Number(event.target.value) || 1))}
                    className="h-8 w-12 text-center tabular-nums"
                  />
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Tăng"
                    onClick={() => setQuantity(index, component.quantity + 1)}
                  >
                    <Plus />
                  </Button>
                </ButtonGroup>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Bỏ nguyên liệu"
                  onClick={() => setComponents((current) => current.filter((_, position) => position !== index))}
                >
                  <Trash2 />
                </Button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          {status === "verified"
            ? "Thêm ít nhất một nguyên liệu."
            : status === "none"
              ? "Món này không cần ghép."
              : "Chưa đủ dữ liệu công thức."}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <ItemPicker
          items={workspace.items}
          exclude={new Set([item.id, ...components.map((component) => component.itemId)])}
          onPick={(itemId) => {
            setComponents((current) => [...current, { itemId, quantity: 1 }])
            setStatus("verified")
          }}
        />
        {status !== "verified" && components.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setComponents([])}>
            Xoá nguyên liệu
          </Button>
        )}
      </div>

      {components.length > 0 && (
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-md bg-muted/50 p-3 text-sm">
          <dt className="text-muted-foreground">Tổng giá nguyên liệu</dt>
          <dd className="text-right tabular-nums">{formatNumber(total)} vàng</dd>
          <dt className="text-muted-foreground">Giá món đích</dt>
          <dd className="text-right tabular-nums">{formatNumber(item.price)} vàng</dd>
          <dt className="font-medium">Phí ghép ước tính</dt>
          <dd className={cn("text-right font-medium tabular-nums", fee < 0 && "text-destructive")}>
            {formatNumber(fee)} vàng
          </dd>
          <dd className="col-span-2 text-xs text-muted-foreground">
            Chỉ để đối chiếu; quy tắc phí ghép trong game chưa được xác nhận.
          </dd>
        </dl>
      )}

      {draftProblems.length > 0 && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Công thức chưa hợp lệ</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {[...new Set(draftProblems)].map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={!dirty}
          onClick={() => {
            setStatus(item.recipe.status)
            setComponents(item.recipe.components)
          }}
        >
          Hoàn lại
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!dirty || draftProblems.length > 0}
          onClick={() => workspace.updateItem(item.id, (draft) => (draft.recipe = { status, components }))}
        >
          Áp dụng công thức
        </Button>
      </div>
    </section>
  )
}

function RecipeTreeNode({
  node,
  onSelect,
  root,
}: {
  node: RecipeNode
  onSelect: (itemId: string) => void
  root?: boolean
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(node.item.id)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-accent",
          root && "font-medium",
        )}
      >
        <MediaImage path={node.item.image} className="size-6 rounded-sm object-contain" />
        <span className="truncate">{node.item.name}</span>
        {!root && node.quantity > 1 && <Badge variant="secondary">×{node.quantity}</Badge>}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{formatNumber(node.item.price)}</span>
      </button>
      {node.children.length > 0 && (
        <ul className="ml-4 space-y-0.5 border-l pl-2">
          {node.children.map((child) => (
            <RecipeTreeNode key={child.item.id} node={child} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  )
}
