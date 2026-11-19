import { useState } from "react"
import { ChevronDown, Plus, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { fixedCodes, named } from "../guide-codes"
import { normalize } from "@/lib/text"
import { type Item, type SectionProps, swapAt, duplicateAt } from "./guide-model"
import { FormBlock, Segmented, IconUpload, RichField, Thumb } from "./guide-fields"
import { MasterDetail, DetailHeader } from "./master-detail"

export function stoneColor(group: { code: string; name: string }) {
  const key = normalize(`${group.code} ${group.name}`)
  // "xanh lam" contains "xanh la", so blue is checked first.
  if (key.includes("xanh lam") || key.includes("xanh duong")) return "#3fa2f0"
  if (key.includes("xanh la")) return "#a9c63b"
  if (key.includes("vang")) return "#f0b232"
  if (key.includes("do")) return "#e2474b"
  return "#9aa4b2"
}

export function ItemsSection({ content, saved, setContent, image, upload }: SectionProps) {
  const [selected, setSelected] = useState(0)
  const fixed = fixedCodes(saved, content)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const item = content.items[selected]
  const update = (next: Item) => setContent({ ...content, items: swapAt(content.items, selected, next) })
  const groups = [...content.itemGroups, { code: "", name: "Chưa có nhóm", slotCount: null, iconAssetId: null }]
  const groupOf = (code?: string | null) => content.itemGroups.find((group) => group.code === code)
  const stone = (group: { code: string; name: string; iconAssetId?: string | null }, size = "size-5") => {
    const src = image(group.iconAssetId)
    return src ? (
      <img src={src} alt="" className={`${size} shrink-0 object-contain`} />
    ) : (
      <span className="size-2.5 shrink-0 rotate-45" style={{ background: stoneColor(group) }} />
    )
  }

  return (
    <MasterDetail
      title="Trang bị"
      addLabel="Thêm trang bị"
      selected={selected}
      onSelect={setSelected}
      onAdd={() => {
        setContent({
          ...content,
          items: [
            ...content.items,
            {
              code: "",
              name: "",
              effect: null,
              groupCode: content.itemGroups[0]?.code ?? null,
              slot: null,
              iconAssetId: null,
            },
          ],
        })
        setSelected(content.items.length)
      }}
      groups={groups.map((group) => ({
        key: group.code || "none",
        label: (
          <span className="flex items-center gap-1.5">
            {stone(group)}
            {group.name}
          </span>
        ),
        rows: content.items
          .map((entry, index) => ({ entry, index }))
          .filter(({ entry }) => (entry.groupCode ?? "") === group.code)
          .sort((a, b) => (a.entry.slot ?? 99) - (b.entry.slot ?? 99))
          .map(({ entry, index }) => ({
            key: `${entry.code}-${index}`,
            index,
            title: entry.name,
            icon: <Thumb src={image(entry.iconAssetId)} color={stoneColor(group)} />,
            meta: entry.effect?.replace(/<[^>]+>/g, "") ?? undefined,
            warn: !entry.effect,
          })),
      }))}
      footer={
        <div className="grid gap-2 border-t pt-2">
          <button
            type="button"
            className="type-label flex items-center justify-between"
            aria-expanded={groupsOpen}
            onClick={() => setGroupsOpen(!groupsOpen)}
          >
            Nhóm trang bị ({content.itemGroups.length})
            <ChevronDown className={`size-4 transition-transform ${groupsOpen ? "rotate-180" : ""}`} />
          </button>
          {groupsOpen && (
            <div className="grid gap-2">
              {content.itemGroups.map((group, at) => (
                <div key={at} className="grid grid-cols-[auto_minmax(0,1fr)_64px_auto] items-center gap-1.5">
                  <IconUpload
                    size="sm"
                    src={image(group.iconAssetId)}
                    color={stoneColor(group)}
                    label={`Ảnh đá của ${group.name || "nhóm"}`}
                    onFile={async (file) => {
                      const iconAssetId = await upload(file, "item group icon")
                      setContent({ ...content, itemGroups: swapAt(content.itemGroups, at, { ...group, iconAssetId }) })
                    }}
                  />
                  <Input
                    aria-label="Tên nhóm"
                    value={group.name}
                    onChange={(event) =>
                      setContent({
                        ...content,
                        itemGroups: swapAt(content.itemGroups, at, named(group, event.target.value, fixed)),
                      })
                    }
                  />
                  <Input
                    aria-label="Số ô"
                    title="Số ô trong game"
                    type="number"
                    value={group.slotCount ?? ""}
                    onChange={(event) =>
                      setContent({
                        ...content,
                        itemGroups: swapAt(content.itemGroups, at, {
                          ...group,
                          slotCount: event.target.value === "" ? null : Number(event.target.value),
                        }),
                      })
                    }
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Bỏ nhóm ${group.name}`}
                    onClick={() =>
                      setContent({ ...content, itemGroups: content.itemGroups.filter((_, index) => index !== at) })
                    }
                  >
                    <X />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setContent({
                    ...content,
                    itemGroups: [...content.itemGroups, { code: "", name: "", slotCount: null, iconAssetId: null }],
                  })
                }
              >
                <Plus /> Thêm nhóm
              </Button>
            </div>
          )}
        </div>
      }
    >
      {item ? (
        <>
          <DetailHeader
            icon={
              <IconUpload
                size="lg"
                src={image(item.iconAssetId)}
                color={stoneColor(groupOf(item.groupCode) ?? { code: "", name: "" })}
                label="Biểu tượng trang bị"
                onFile={async (file) => update({ ...item, iconAssetId: await upload(file, "item icon") })}
              />
            }
            title={item.name || "Trang bị mới"}
            code={item.code}
            onRename={(code) => update({ ...item, code })}
            onDuplicate={() => {
              setContent({ ...content, items: duplicateAt(content.items, selected) })
              setSelected(selected + 1)
            }}
            deleteLabel={`Xóa trang bị ${item.name}?`}
            onDelete={() => {
              setContent({ ...content, items: content.items.filter((_, index) => index !== selected) })
              setSelected(0)
            }}
          />
          <FormBlock title="Thông tin">
            <label className="grid gap-1">
              <span className="type-label">Tên</span>
              <Input value={item.name} onChange={(event) => update(named(item, event.target.value, fixed))} />
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <span className="type-label">Nhóm</span>
                <Segmented
                  label="Nhóm trang bị"
                  value={item.groupCode ?? ""}
                  onChange={(groupCode) => update({ ...item, groupCode: groupCode || null })}
                  options={content.itemGroups.map((group) => ({
                    value: group.code,
                    label: group.name,
                    color: stoneColor(group),
                    icon: image(group.iconAssetId) ? stone(group, "size-4") : undefined,
                  }))}
                />
              </div>
              <label className="grid w-24 gap-1">
                <span className="type-label">Ô số</span>
                <Input
                  type="number"
                  min={1}
                  value={item.slot ?? ""}
                  onChange={(event) =>
                    update({ ...item, slot: event.target.value === "" ? null : Number(event.target.value) })
                  }
                />
              </label>
            </div>
          </FormBlock>
          <FormBlock title="Hiệu ứng">
            <RichField label="Hiệu ứng" bare value={item.effect} onChange={(effect) => update({ ...item, effect })} />
          </FormBlock>
        </>
      ) : (
        <p className="type-body text-muted-foreground">Chọn hoặc thêm một trang bị.</p>
      )}
    </MasterDetail>
  )
}
