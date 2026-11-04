import { useState, type ReactNode } from "react"
import { ChevronDown, Plus, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@aov/ui/components/command"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { matchesQuery } from "@/lib/text"
import { Field, control } from "../publishing/fields"
import { HeroAsset } from "../publishing/hero-asset"
import { recipeConnectionError } from "./item-graph"
import { warehouseName, type ItemContent, type WarehouseEntry } from "./warehouse-types"

type Item = WarehouseEntry<ItemContent>
const statusNames = { UNKNOWN: "Chưa xác nhận", NONE: "Không cần ghép", VERIFIED: "Đã xác nhận công thức" }

export function RecipeItemLabel({ item, locale }: { item?: Item; locale: string }) {
  return (
    <>
      <HeroAsset id={item?.content.iconAssetId} className="size-9 shrink-0 rounded-md" frameAspectRatio={1} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium">
          {item ? warehouseName(item, locale) : "Nguyên liệu chưa tải được"}
        </span>
        {item?.content.price != null && (
          <span className="type-meta block">{item.content.price.toLocaleString(locale)} vàng</span>
        )}
      </span>
    </>
  )
}

function IngredientPicker({
  current,
  replace,
  options,
  locale,
  onPick,
}: {
  current?: Item
  replace?: boolean
  options: Item[]
  locale: string
  onPick: (item: Item) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [limit, setLimit] = useState(12)
  const matches = open ? options.filter((item) => matchesQuery(query, warehouseName(item, locale), item.code)) : []
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setQuery("")
        setLimit(12)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={replace ? "ghost" : "outline"}
          size="sm"
          disabled={!options.length}
          aria-label={
            replace ? `Đổi nguyên liệu ${current ? warehouseName(current, locale) : ""}`.trim() : "Thêm nguyên liệu"
          }
          className={replace ? "h-auto min-w-0 flex-1 justify-start px-1 py-1" : ""}
        >
          {replace ? (
            <>
              <RecipeItemLabel item={current} locale={locale} />
              <ChevronDown className="size-4 shrink-0" />
            </>
          ) : (
            <>
              <Plus />
              Thêm nguyên liệu
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={12} className="w-80 max-w-[calc(100vw-1.5rem)] p-0">
        <Command shouldFilter={false} label="Chọn nguyên liệu">
          <CommandInput
            aria-label="Tìm nguyên liệu"
            placeholder="Tìm tên hoặc mã trang bị…"
            value={query}
            onValueChange={(value) => {
              setQuery(value)
              setLimit(12)
            }}
          />
          <CommandList className="max-h-[min(18rem,35dvh)] p-1">
            <CommandEmpty>Không tìm thấy nguyên liệu phù hợp.</CommandEmpty>
            {matches.slice(0, limit).map((item) => (
              <CommandItem
                key={item.id}
                value={item.id}
                onSelect={() => {
                  setOpen(false)
                  onPick(item)
                }}
              >
                <RecipeItemLabel item={item} locale={locale} />
              </CommandItem>
            ))}
          </CommandList>
          {matches.length > limit && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setLimit(limit + 12)}>
              Xem thêm nguyên liệu ({matches.length - limit})
            </Button>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function ItemRecipe({
  itemId,
  content,
  items,
  locale,
  onChange,
  onView,
  action,
}: {
  itemId: string
  action?: ReactNode
  content: ItemContent
  items: Item[]
  locale: string
  onChange?: (patch: Partial<ItemContent>) => void
  onView?: (item: Item) => void
}) {
  const parts = content.components
  const rows = parts.map((part) => ({ ...part, item: items.find((item) => item.id === part.itemId) }))
  const options = onChange
    ? items.filter(
        (item) => !parts.some((part) => part.itemId === item.id) && !recipeConnectionError(items, item.id, itemId),
      )
    : []
  const total = rows.reduce<number | null>(
    (sum, row) =>
      sum === null || row.item?.content.price == null ? null : sum + row.item.content.price * row.quantity,
    0,
  )
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="type-section-title">Công thức trực tiếp</h3>
        {onChange ? (
          <select
            className={`${control} w-auto`}
            aria-label="Trạng thái công thức"
            value={content.recipeStatus}
            onChange={(event) => {
              const status = event.target.value as ItemContent["recipeStatus"]
              onChange({ recipeStatus: status, components: status === "VERIFIED" ? parts : [] })
            }}
          >
            {Object.entries(statusNames).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-2">
            <span className="type-meta">{statusNames[content.recipeStatus]}</span>
            {action}
          </div>
        )}
      </div>
      {rows.map(({ itemId: id, item, quantity }, index) => (
        <div key={id} className="flex min-w-0 items-center gap-2 border-b py-1.5">
          {onChange ? (
            <>
              <IngredientPicker
                current={item}
                replace
                options={options}
                locale={locale}
                onPick={(next) =>
                  onChange({ components: parts.map((part, i) => (i === index ? { ...part, itemId: next.id } : part)) })
                }
              />
              <div className="w-16 shrink-0">
                <Field
                  label="Số lượng"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(v) =>
                    onChange({
                      components: parts.map((part, i) => (i === index ? { ...part, quantity: Number(v) } : part)),
                    })
                  }
                />
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Bỏ nguyên liệu ${index + 1}`}
                onClick={() => onChange({ components: parts.filter((_, i) => i !== index) })}
              >
                <Trash2 />
              </Button>
            </>
          ) : (
            <>
              {item && onView ? (
                <button
                  type="button"
                  aria-label={`Xem ${warehouseName(item, locale)}`}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left hover:bg-accent"
                  onClick={() => onView(item)}
                >
                  <RecipeItemLabel item={item} locale={locale} />
                </button>
              ) : (
                <RecipeItemLabel item={item} locale={locale} />
              )}
              <span className="text-sm tabular-nums">×{quantity}</span>
            </>
          )}
        </div>
      ))}
      {onChange && (
        <IngredientPicker
          options={options}
          locale={locale}
          onPick={(item) =>
            onChange({ recipeStatus: "VERIFIED", components: [...parts, { itemId: item.id, quantity: 1 }] })
          }
        />
      )}
      {rows.length > 0 && (
        <p className="type-meta">
          {total === null
            ? "Chưa đủ giá nguyên liệu để tính tổng."
            : `Tổng giá nguyên liệu · ${total.toLocaleString(locale)} vàng`}
        </p>
      )}
    </section>
  )
}
