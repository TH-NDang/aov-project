import { useState } from "react"
import { Input } from "@aov/ui/components/input"
import { fixedCodes, named } from "../guide-codes"
import { type Blessing, type SectionProps, swapAt, duplicateAt } from "./guide-model"
import { FormBlock, Segmented, RichField } from "./guide-fields"
import { MasterDetail, DetailHeader } from "./master-detail"

/** The game's blessing tiers: blue, purple and bronze cards with a brighter title. */
export const TIER_COLOR: Record<Blessing["tier"], string> = { NORMAL: "#4fb0ff", EPIC: "#e277ff", LEGENDARY: "#ffab45" }

const TIER_BACKGROUND: Record<Blessing["tier"], string> = {
  NORMAL: "linear-gradient(180deg, #1b3988, #2b5cc4)",
  EPIC: "linear-gradient(180deg, #491c7a, #7f3ca8)",
  LEGENDARY: "linear-gradient(180deg, #5a3110, #96591f)",
}

export const TIER_LABEL: Record<Blessing["tier"], string> = {
  NORMAL: "Thường",
  EPIC: "Huyền thoại / Sử thi",
  LEGENDARY: "Truyền thuyết",
}

/** White drawings on black, screen blended onto the tier's card color like in the game and on the Wiki. */
export function BlessingThumb({
  src,
  tier,
  size = "sm",
}: {
  src?: string
  tier: Blessing["tier"]
  size?: "sm" | "lg"
}) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center overflow-hidden ${size === "lg" ? "size-20 rounded-lg" : "size-8 rounded-md"}`}
      style={{ background: TIER_BACKGROUND[tier], isolation: "isolate" }}
    >
      {src && <img src={src} alt="" className="size-[88%] object-contain mix-blend-screen" />}
    </span>
  )
}

/** The blessing as the reader sees it: the game's card for its tier. */
function BlessingPreview({ blessing, src }: { blessing: Blessing; src?: string }) {
  return (
    <div
      className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-3 overflow-hidden rounded-md border border-black/30 px-4 py-4 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14)]"
      style={{ background: TIER_BACKGROUND[blessing.tier], isolation: "isolate" }}
    >
      <span className="grid size-14 place-items-center">
        {src && <img src={src} alt="" className="size-full object-contain mix-blend-screen" />}
      </span>
      <span className="grid gap-0.5">
        <span className="type-section-title" style={{ color: TIER_COLOR[blessing.tier] }}>
          {blessing.name || "Tên chúc phúc"}
        </span>
        <span className="type-body text-white/80">
          {blessing.description?.replace(/<[^>]+>/g, "") || "Mô tả hiện ở đây."}
        </span>
      </span>
    </div>
  )
}

export function BlessingsSection({ content, saved, setContent, image, upload }: SectionProps) {
  const [selected, setSelected] = useState(0)
  const fixed = fixedCodes(saved, content)
  const blessing = content.blessings[selected]
  const update = (next: Blessing) => setContent({ ...content, blessings: swapAt(content.blessings, selected, next) })
  return (
    <MasterDetail
      title="Chúc phúc"
      addLabel="Thêm chúc phúc"
      selected={selected}
      onSelect={setSelected}
      onAdd={() => {
        setContent({
          ...content,
          blessings: [
            ...content.blessings,
            { code: "", tier: "NORMAL", name: "", description: null, iconAssetId: null },
          ],
        })
        setSelected(content.blessings.length)
      }}
      groups={(["NORMAL", "EPIC", "LEGENDARY"] as const).map((tier) => ({
        key: tier,
        label: (
          <span className="flex items-center gap-1.5" style={{ color: TIER_COLOR[tier] }}>
            <span className="size-2 rounded-full bg-current" /> {TIER_LABEL[tier]}
          </span>
        ),
        rows: content.blessings
          .map((entry, index) => ({ entry, index }))
          .filter(({ entry }) => entry.tier === tier)
          .map(({ entry, index }) => ({
            key: `${entry.code}-${index}`,
            index,
            title: entry.name,
            icon: <BlessingThumb src={image(entry.iconAssetId)} tier={entry.tier} />,
            meta: entry.description?.replace(/<[^>]+>/g, "") ?? undefined,
            warn: !entry.description,
          })),
      }))}
    >
      {blessing ? (
        <>
          <DetailHeader
            icon={
              <label className="relative cursor-pointer" title="Đổi biểu tượng">
                <BlessingThumb src={image(blessing.iconAssetId)} tier={blessing.tier} size="lg" />
                <input
                  type="file"
                  hidden
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ""
                    if (file) update({ ...blessing, iconAssetId: await upload(file, "blessing icon") })
                  }}
                />
              </label>
            }
            title={blessing.name || "Chúc phúc mới"}
            code={blessing.code}
            onRename={(code) => update({ ...blessing, code })}
            onDuplicate={() => {
              setContent({ ...content, blessings: duplicateAt(content.blessings, selected) })
              setSelected(selected + 1)
            }}
            deleteLabel={`Xóa chúc phúc ${blessing.name}?`}
            onDelete={() => {
              setContent({ ...content, blessings: content.blessings.filter((_, index) => index !== selected) })
              setSelected(0)
            }}
          />
          <FormBlock title="Xem trước" hint="Thẻ chúc phúc như người đọc thấy trên Wiki, theo màu bậc trong game.">
            <BlessingPreview blessing={blessing} src={image(blessing.iconAssetId)} />
          </FormBlock>
          <FormBlock title="Thông tin">
            <label className="grid gap-1">
              <span className="type-label">Tên</span>
              <Input value={blessing.name} onChange={(event) => update(named(blessing, event.target.value, fixed))} />
            </label>
            <div className="grid gap-1">
              <span className="type-label">Bậc</span>
              <Segmented
                label="Bậc"
                value={blessing.tier}
                onChange={(tier) => update({ ...blessing, tier })}
                options={(["NORMAL", "EPIC", "LEGENDARY"] as const).map((tier) => ({
                  value: tier,
                  label: TIER_LABEL[tier],
                  color: TIER_COLOR[tier],
                }))}
              />
            </div>
          </FormBlock>
          <FormBlock title="Mô tả">
            <RichField
              label="Mô tả"
              bare
              value={blessing.description}
              onChange={(description) => update({ ...blessing, description })}
            />
          </FormBlock>
        </>
      ) : (
        <p className="type-body text-muted-foreground">Chọn hoặc thêm một chúc phúc.</p>
      )}
    </MasterDetail>
  )
}

// Quests: short rows, edited in place
