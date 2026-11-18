import { useMemo, useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { fixedCodes, named } from "../guide-codes"
import { type Unit, type Trait, type SectionProps, COST_COLOR, swapAt, duplicateAt, renameTrait } from "./guide-model"
import { FormBlock, Segmented, IconUpload, RichField, Thumb } from "./guide-fields"
import { MasterDetail, DetailHeader } from "./master-detail"

export function TraitsSection({ content, saved, setContent, image, upload }: SectionProps) {
  const [selected, setSelected] = useState(0)
  const fixed = fixedCodes(saved, content)
  const trait = content.traits[selected]
  const update = (next: Trait) => setContent({ ...content, traits: swapAt(content.traits, selected, next) })
  const members = useMemo(() => {
    const map = new Map<string, Unit[]>()
    content.units.forEach((unit) => unit.traitCodes.forEach((code) => map.set(code, [...(map.get(code) ?? []), unit])))
    return map
  }, [content.units])

  return (
    <MasterDetail
      title="Phe/Nghề"
      addLabel="Thêm Phe/Nghề"
      selected={selected}
      onSelect={setSelected}
      onAdd={() => {
        setContent({
          ...content,
          traits: [
            ...content.traits,
            { code: "", kind: "FACTION", name: "", description: null, iconAssetId: null, tiers: [], note: null },
          ],
        })
        setSelected(content.traits.length)
      }}
      groups={(["FACTION", "CLASS"] as const).map((kind) => ({
        key: kind,
        label: kind === "FACTION" ? "Phe" : "Nghề",
        rows: content.traits
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => item.kind === kind)
          .map(({ item, index }) => ({
            key: `${item.code}-${index}`,
            index,
            title: item.name,
            icon: <Thumb src={image(item.iconAssetId)} round />,
            meta: `${members.get(item.code)?.length ?? 0} quân · mốc ${item.tiers.map((tier) => tier.count).join("/") || "–"}`,
            warn: !item.tiers.length,
          })),
      }))}
    >
      {trait ? (
        <>
          <DetailHeader
            icon={
              <IconUpload
                size="lg"
                round
                src={image(trait.iconAssetId)}
                label="Biểu tượng Phe/Nghề"
                onFile={async (file) => update({ ...trait, iconAssetId: await upload(file, "trait icon") })}
              />
            }
            title={trait.name || "Phe/Nghề mới"}
            code={trait.code}
            onRename={(code) => setContent(renameTrait(content, trait.code, code))}
            onDuplicate={() => {
              setContent({ ...content, traits: duplicateAt(content.traits, selected) })
              setSelected(selected + 1)
            }}
            deleteLabel={`Xóa ${trait.name}?`}
            onDelete={() => {
              setContent({ ...content, traits: content.traits.filter((_, index) => index !== selected) })
              setSelected(0)
            }}
          />
          <FormBlock title="Thông tin">
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid min-w-48 flex-1 gap-1">
                <span className="type-label">Tên</span>
                <Input value={trait.name} onChange={(event) => update(named(trait, event.target.value, fixed))} />
              </label>
              <div className="grid gap-1">
                <span className="type-label">Loại</span>
                <Segmented
                  label="Loại"
                  value={trait.kind}
                  onChange={(kind) => update({ ...trait, kind })}
                  options={[
                    { value: "FACTION", label: "Phe" },
                    { value: "CLASS", label: "Nghề" },
                  ]}
                />
              </div>
            </div>
            <RichField
              label="Mô tả chung (tùy chọn)"
              short
              value={trait.description}
              onChange={(description) => update({ ...trait, description })}
            />
          </FormBlock>
          <FormBlock title="Mốc kích hoạt" hint="Số quân cờ khác nhau cần có và hiệu ứng khi đạt mốc.">
            <ol className="grid gap-2">
              {trait.tiers.map((tier, at) => (
                <li key={at} className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-start gap-2">
                  <Input
                    type="number"
                    min={1}
                    aria-label={`Số quân của mốc ${at + 1}`}
                    className="text-center tabular-nums"
                    value={tier.count}
                    onChange={(event) =>
                      update({
                        ...trait,
                        tiers: swapAt(trait.tiers, at, { ...tier, count: Number(event.target.value) }),
                      })
                    }
                  />
                  <RichField
                    label={`Hiệu ứng mốc ${tier.count}`}
                    short
                    bare
                    value={tier.effect}
                    onChange={(effect) =>
                      update({ ...trait, tiers: swapAt(trait.tiers, at, { ...tier, effect: effect ?? "" }) })
                    }
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Bỏ mốc ${tier.count}`}
                    onClick={() => update({ ...trait, tiers: trait.tiers.filter((_, index) => index !== at) })}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ol>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="justify-self-start"
              onClick={() =>
                update({
                  ...trait,
                  tiers: [...trait.tiers, { count: (trait.tiers.at(-1)?.count ?? 0) + 2, effect: "" }],
                })
              }
            >
              <Plus /> Thêm mốc
            </Button>
          </FormBlock>
          <FormBlock title="Quân cờ thuộc nhóm" hint="Chọn Phe/Nghề ở từng quân cờ để thêm vào đây.">
            <div className="flex flex-wrap gap-2">
              {(members.get(trait.code) ?? []).map((unit) => (
                <span
                  key={unit.code}
                  className="type-meta inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5"
                >
                  <Thumb src={image(unit.portraitAssetId)} color={COST_COLOR[unit.cost]} />
                  {unit.name}
                </span>
              ))}
              {!members.get(trait.code)?.length && <span className="type-meta">Chưa có quân cờ nào.</span>}
            </div>
          </FormBlock>
          <FormBlock title="Ghi chú biên tập">
            <Input
              value={trait.note ?? ""}
              onChange={(event) => update({ ...trait, note: event.target.value || null })}
            />
          </FormBlock>
        </>
      ) : (
        <p className="type-body text-muted-foreground">Chọn hoặc thêm một Phe/Nghề.</p>
      )}
    </MasterDetail>
  )
}
