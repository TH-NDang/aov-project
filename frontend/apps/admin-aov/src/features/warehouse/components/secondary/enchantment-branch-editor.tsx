import { useEffect, useState } from "react"
import { Image, Languages, LoaderCircle, Settings2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@aov/ui/components/tabs"
import { useIsWide } from "@/hooks/use-media-query"
import { errorMessage } from "@/lib/api/errors"
import { AssetPicker } from "../../../publishing/components/assets/asset-picker"
import { Field } from "../../../publishing/components/editing/fields"
import { WarehouseTranslations } from "../sheet/warehouse-translations"
import { enchantmentBranchColor } from "@aov/ui/lib/enchantment-colors"
import { WarehouseOrderPicker } from "./warehouse-order-picker"
import type { WarehouseMetadata } from "../../model/warehouse-types"
import { warehouseText } from "@aov/ui/lib/warehouse-content"
import { confirmDiscard } from "@/components/confirm-dialog"

export function EnchantmentBranchEditor({
  branch,
  locale,
  kind = "enchantments",
  onSave,
  onClose,
  branches = [],
  onReorderBranches,
}: {
  branch: WarehouseMetadata | null
  locale: string
  kind?: "items" | "enchantments"
  onSave: (value: WarehouseMetadata) => Promise<void>
  onClose: () => void
  branches?: WarehouseMetadata[]
  onReorderBranches?: (ids: string[]) => Promise<void>
}) {
  const wide = useIsWide()
  const entityName = kind === "items" ? "nhóm trang bị" : "hệ phù hiệu"
  const [value, setValue] = useState<WarehouseMetadata>(
    branch ?? {
      code: "",
      version: 0,
      displayOrder: 0,
      iconAssetId: null,
      backgroundAssetId: null,
      color: "#d6ad57",
      translations: [{ locale, name: "", description: null, suitability: null }],
    },
  )
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const displayColor = kind === "enchantments" ? enchantmentBranchColor(value) : (value.color ?? "#d6ad57")
  function update(patch: Partial<WarehouseMetadata>) {
    setValue((current) => ({ ...current, ...patch }))
    setDirty(true)
  }
  async function close() {
    if (busy || uploading) return
    if (
      !dirty ||
      (await confirmDiscard({ title: "Đóng phần chỉnh sửa?", description: `Có thay đổi ${entityName} chưa lưu.` }))
    )
      onClose()
  }
  useEffect(() => {
    if (!dirty && !busy && !uploading) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [dirty, busy, uploading])
  async function save() {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.code) ||
      !value.translations.length ||
      value.translations.some((text) => !text.name.trim())
    ) {
      setError("Cần mã không dấu và tên của các bản dịch đã thêm.")
      return
    }
    setBusy(true)
    setError("")
    try {
      await onSave({
        ...value,
        translations: value.translations.map(({ locale, name, description, suitability }) => ({
          locale,
          name,
          description: description || null,
          suitability: suitability || null,
        })),
      })
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet open onOpenChange={(open) => !open && void close()}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={
          wide
            ? "flex w-[min(640px,94vw)] flex-col overflow-hidden sm:max-w-none"
            : "flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl"
        }
      >
        <SheetHeader className="pr-8">
          <SheetTitle>{branch ? `Chỉnh sửa ${entityName}` : `Tạo ${entityName}`}</SheetTitle>
          <SheetDescription>Thiết lập bố cục và các bản dịch.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-auto overflow-y-auto px-4 pb-4">
          <Tabs defaultValue="information" className="gap-5">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="information">
                <Settings2 className="size-4" /> Thông tin
              </TabsTrigger>
              <TabsTrigger value="translations">
                <Languages className="size-4" /> Bản dịch
              </TabsTrigger>
              <TabsTrigger value="images">
                <Image className="size-4" /> Ảnh
              </TabsTrigger>
            </TabsList>
            <TabsContent value="information" className="space-y-4">
              <Field
                label={kind === "items" ? "Mã nhóm" : "Mã hệ"}
                value={value.code}
                onChange={(code) => update({ code })}
                disabled={!!branch || busy}
              />
              {kind === "items" ? (
                <Field
                  label="Thứ tự hiển thị"
                  type="number"
                  min={0}
                  step={1}
                  value={value.displayOrder}
                  onChange={(displayOrder) => update({ displayOrder: Number(displayOrder) })}
                  disabled={busy}
                />
              ) : (
                <WarehouseOrderPicker
                  label="Thứ tự các hệ"
                  items={branches.map((entry) => ({
                    id: entry.code,
                    name: warehouseText(entry.translations, locale)?.name ?? entry.code,
                    iconAssetId: entry.iconAssetId,
                    color: enchantmentBranchColor(entry),
                  }))}
                  disabled={!branch || dirty || busy || uploading || !onReorderBranches}
                  disabledReason={
                    !branch ? "Lưu hệ mới trước khi sắp xếp." : dirty ? "Lưu thay đổi trước khi sắp xếp." : undefined
                  }
                  onSave={async (ids) => {
                    await onReorderBranches?.(ids)
                  }}
                />
              )}
              <label className="grid gap-1.5 text-sm">
                <span>Màu nhận diện</span>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label="Màu nhận diện hệ"
                    className="h-10 w-14 cursor-pointer rounded-md border bg-background p-1"
                    value={displayColor}
                    disabled={busy}
                    onChange={(event) => update({ color: event.target.value })}
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {value.color?.trim() || `${displayColor} · Mặc định`}
                  </span>
                </div>
              </label>
            </TabsContent>
            <TabsContent value="translations">
              <WarehouseTranslations
                value={value.translations}
                onChange={(translations) => update({ translations })}
                locale={locale}
                disabled={busy}
                showSummary={false}
              />
            </TabsContent>
            <TabsContent value="images" className="space-y-5">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Biểu tượng</h3>
                <AssetPicker
                  semanticType={kind === "items" ? "ITEM_ICON" : "ENCHANTMENT_ICON"}
                  value={value.iconAssetId}
                  onChange={(iconAssetId) => update({ iconAssetId })}
                  onBusyChange={setUploading}
                />
              </div>
              <div className="space-y-2 border-t pt-4">
                <h3 className="text-sm font-medium">Ảnh nền</h3>
                <AssetPicker
                  semanticType="OTHER"
                  value={value.backgroundAssetId}
                  onChange={(backgroundAssetId) => update({ backgroundAssetId })}
                  onBusyChange={setUploading}
                />
              </div>
            </TabsContent>
          </Tabs>
          {error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <footer className="flex shrink-0 justify-end border-t p-4">
          <Button disabled={!dirty || busy || uploading} onClick={() => void save()}>
            {(busy || uploading) && <LoaderCircle className="size-4 animate-spin" />} Lưu {entityName}
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  )
}
