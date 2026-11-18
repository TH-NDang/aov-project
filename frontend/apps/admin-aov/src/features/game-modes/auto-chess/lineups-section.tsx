import { useState } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@aov/ui/components/input"
import { Textarea } from "@aov/ui/components/textarea"
import type { GuideLineup } from "../game-mode-api"
import { fixedCodes, named } from "../guide-codes"
import { normalize } from "@/lib/text"
import { type SectionProps, COST_COLOR, swapAt, duplicateAt } from "./guide-model"
import { TIER_COLOR, TIER_LABEL, BlessingThumb } from "./blessings-section"
import { FormBlock, Segmented, Thumb } from "./guide-fields"
import { MasterDetail, DetailHeader } from "./master-detail"
import { TraitPicker } from "./units-section"
import { stoneColor } from "./items-section"
import { CodePicker, OrderedChips } from "./lineup-pickers"
import { StageEditor } from "./lineup-stages"
import { BoardEditor } from "./lineup-board"

const LINEUP_TIER_COLOR: Record<string, string> = { S: "#e05555", A: "#e0954a", B: "#d8c35a", C: "#6aa86a" }

const DIFFICULTY_LABEL = { EASY: "Dễ", MEDIUM: "Vừa", HARD: "Khó" } as const

const tierRank = (tier?: string | null) => (tier ? "SABC".indexOf(tier) : 9)

// Lineup extras: picking items and blessings, in order

export function LineupsSection({ content, saved, setContent, image }: Omit<SectionProps, "upload">) {
  const [selected, setSelected] = useState(0)
  const fixed = fixedCodes(saved, content)
  const [search, setSearch] = useState("")
  const lineup = content.lineups[selected]
  const update = (next: GuideLineup) => setContent({ ...content, lineups: swapAt(content.lineups, selected, next) })
  const units = new Map(content.units.map((unit) => [unit.code, unit]))
  const traits = new Map(content.traits.map((trait) => [trait.code, trait]))
  const costs = [...new Set(content.units.map((unit) => unit.cost))].sort((a, b) => a - b)
  const needle = normalize(search.trim())
  const itemByCode = new Map(content.items.map((item) => [item.code, item]))
  const blessingByCode = new Map(content.blessings.map((blessing) => [blessing.code, blessing]))
  const itemGroups = [...content.itemGroups, { code: "", name: "Khác", slotCount: null, iconAssetId: null }].map(
    (group) => ({
      key: group.code || "other",
      title: group.name,
      options: content.items
        .filter((item) => (item.groupCode ?? "") === group.code)
        .map((item) => ({
          code: item.code,
          name: item.name,
          thumb: <Thumb src={image(item.iconAssetId)} color={stoneColor(group)} />,
        })),
    }),
  )
  const blessingGroups = (["NORMAL", "EPIC", "LEGENDARY"] as const).map((tier) => ({
    key: tier,
    title: <span style={{ color: TIER_COLOR[tier] }}>{TIER_LABEL[tier]}</span>,
    options: content.blessings
      .filter((blessing) => blessing.tier === tier)
      .map((blessing) => ({
        code: blessing.code,
        name: blessing.name,
        thumb: <BlessingThumb src={image(blessing.iconAssetId)} tier={blessing.tier} />,
      })),
  }))
  const itemThumb = (code: string) => {
    const item = itemByCode.get(code)
    return { name: item?.name ?? code, thumb: <Thumb src={image(item?.iconAssetId)} /> }
  }

  return (
    <MasterDetail
      title="Đội hình đề xuất"
      addLabel="Thêm đội hình"
      selected={selected}
      onSelect={setSelected}
      onAdd={() => {
        setContent({
          ...content,
          lineups: [
            ...content.lineups,
            {
              code: "",
              name: "",
              tier: null,
              difficulty: null,
              summary: null,
              units: [],
              emblems: [],
              blessingCodes: [],
              notes: null,
              stages: [],
              priorityItemCodes: [],
            },
          ],
        })
        setSelected(content.lineups.length)
      }}
      groups={[
        {
          key: "all",
          label: "Hạng S → C, chưa xếp hạng cuối",
          rows: content.lineups
            .map((entry, index) => ({ entry, index }))
            .sort((a, b) => tierRank(a.entry.tier) - tierRank(b.entry.tier))
            .map(({ entry, index }) => ({
              key: `${entry.code}-${index}`,
              index,
              title: entry.name,
              icon: (
                <span
                  className="type-label grid size-8 shrink-0 place-items-center rounded-md"
                  style={{
                    background: LINEUP_TIER_COLOR[entry.tier ?? ""] ?? "var(--muted)",
                    color: entry.tier ? "#120d06" : undefined,
                  }}
                >
                  {entry.tier ?? "–"}
                </span>
              ),
              meta: (
                <span className="flex items-center gap-0.5">
                  {entry.units.slice(0, 8).map((member) => {
                    const src = image(units.get(member.unitCode)?.portraitAssetId)
                    return src ? <img key={member.unitCode} src={src} alt="" className="size-4 rounded-sm" /> : null
                  })}
                </span>
              ),
              warn: !entry.units.length,
            })),
        },
      ]}
    >
      {lineup ? (
        <>
          <DetailHeader
            icon={
              <span
                className="type-page-title grid size-14 place-items-center rounded-lg"
                style={{
                  background: LINEUP_TIER_COLOR[lineup.tier ?? ""] ?? "var(--muted)",
                  color: lineup.tier ? "#120d06" : undefined,
                }}
              >
                {lineup.tier ?? "–"}
              </span>
            }
            title={lineup.name || "Đội hình mới"}
            code={lineup.code}
            onRename={(code) => update({ ...lineup, code })}
            onDuplicate={() => {
              setContent({ ...content, lineups: duplicateAt(content.lineups, selected) })
              setSelected(selected + 1)
            }}
            deleteLabel={`Xóa đội hình ${lineup.name}?`}
            onDelete={() => {
              setContent({ ...content, lineups: content.lineups.filter((_, index) => index !== selected) })
              setSelected(0)
            }}
          />
          <FormBlock title="Thông tin" hint="Hạng là đánh giá biên tập; để trống nếu chưa kiểm chứng trong trận.">
            <label className="grid gap-1">
              <span className="type-label">Tên</span>
              <Input value={lineup.name} onChange={(event) => update(named(lineup, event.target.value, fixed))} />
            </label>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <div className="grid gap-1">
                <span className="type-label">Hạng</span>
                <Segmented
                  label="Hạng"
                  value={lineup.tier ?? "none"}
                  onChange={(tier) => update({ ...lineup, tier: tier === "none" ? null : tier })}
                  options={[
                    { value: "none" as const, label: "Chưa xếp" },
                    ...(["S", "A", "B", "C"] as const).map((tier) => ({
                      value: tier,
                      label: tier,
                      color: LINEUP_TIER_COLOR[tier],
                    })),
                  ]}
                />
              </div>
              <div className="grid gap-1">
                <span className="type-label">Độ khó</span>
                <Segmented
                  label="Độ khó"
                  value={lineup.difficulty ?? "none"}
                  onChange={(difficulty) =>
                    update({ ...lineup, difficulty: difficulty === "none" ? null : difficulty })
                  }
                  options={[
                    { value: "none" as const, label: "Chưa rõ" },
                    ...(["EASY", "MEDIUM", "HARD"] as const).map((difficulty) => ({
                      value: difficulty,
                      label: DIFFICULTY_LABEL[difficulty],
                    })),
                  ]}
                />
              </div>
            </div>
          </FormBlock>
          <FormBlock
            title={`Quân cờ · ${Math.min(lineup.units.length, 10)}/10${lineup.units.length > 10 ? " + ô thêm" : ""}`}
            hint="Bấm M để đánh dấu chủ lực, + để thêm trang bị cho quân (tối đa 3), bấm quân cờ bên dưới để thêm hoặc bỏ."
          >
            <div className="flex min-h-20 flex-wrap gap-2 rounded-lg border border-dashed p-2">
              {lineup.units.map((member) => {
                const unit = units.get(member.unitCode)
                return (
                  <span key={member.unitCode} className="relative grid w-20 justify-items-center gap-0.5">
                    <Thumb src={image(unit?.portraitAssetId)} color={COST_COLOR[unit?.cost ?? 1]} />
                    <span className="type-meta max-w-16 truncate">{unit?.name ?? member.unitCode}</span>
                    <span className="flex min-h-6 items-center gap-0.5" aria-label={`Trang bị của ${unit?.name}`}>
                      {member.itemCodes.map((code) => (
                        <button
                          key={code}
                          type="button"
                          title={`Bỏ ${itemByCode.get(code)?.name ?? code}`}
                          onClick={() =>
                            update({
                              ...lineup,
                              units: lineup.units.map((item) =>
                                item === member
                                  ? { ...item, itemCodes: item.itemCodes.filter((entry) => entry !== code) }
                                  : item,
                              ),
                            })
                          }
                        >
                          <img
                            src={image(itemByCode.get(code)?.iconAssetId)}
                            alt={itemByCode.get(code)?.name ?? code}
                            className="size-5 rounded-sm"
                          />
                        </button>
                      ))}
                      {member.itemCodes.length < 3 && (
                        <CodePicker
                          iconOnly
                          label={`Thêm trang bị cho ${unit?.name ?? member.unitCode}`}
                          groups={itemGroups}
                          chosen={member.itemCodes}
                          max={3}
                          onToggle={(code) =>
                            update({
                              ...lineup,
                              units: lineup.units.map((item) =>
                                item === member
                                  ? {
                                      ...item,
                                      itemCodes: item.itemCodes.includes(code)
                                        ? item.itemCodes.filter((entry) => entry !== code)
                                        : [...item.itemCodes, code],
                                    }
                                  : item,
                              ),
                            })
                          }
                        />
                      )}
                    </span>
                    <span className="flex gap-0.5">
                      <button
                        type="button"
                        aria-pressed={member.carry}
                        aria-label={`${unit?.name} là chủ lực`}
                        title="Chủ lực (M)"
                        className={`type-label grid size-6 place-items-center rounded ${member.carry ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:text-foreground"}`}
                        onClick={() =>
                          update({
                            ...lineup,
                            units: lineup.units.map((item) =>
                              item === member ? { ...item, carry: !item.carry } : item,
                            ),
                          })
                        }
                      >
                        M
                      </button>
                      <button
                        type="button"
                        aria-label={`Bỏ ${unit?.name}`}
                        className="grid size-6 place-items-center rounded text-muted-foreground hover:text-destructive"
                        onClick={() => update({ ...lineup, units: lineup.units.filter((item) => item !== member) })}
                      >
                        <X className="size-4" />
                      </button>
                    </span>
                  </span>
                )
              })}
              {!lineup.units.length && <span className="type-meta self-center">Chưa có quân cờ nào.</span>}
            </div>
            <label className="relative max-w-72">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Tìm quân cờ để thêm…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
              {costs.map((cost) => {
                const pool = content.units.filter(
                  (unit) => unit.cost === cost && (!needle || normalize(unit.name).includes(needle)),
                )
                if (!pool.length) return null
                return (
                  <div key={cost} className="flex flex-wrap items-center gap-1.5">
                    <span className="type-meta w-14 shrink-0" style={{ color: COST_COLOR[cost] }}>
                      {cost} vàng
                    </span>
                    {pool.map((unit) => {
                      const chosen = lineup.units.some((item) => item.unitCode === unit.code)
                      return (
                        <button
                          key={unit.code}
                          type="button"
                          aria-pressed={chosen}
                          title={unit.name}
                          disabled={!chosen && lineup.units.length >= 11}
                          onClick={() =>
                            update({
                              ...lineup,
                              units: chosen
                                ? lineup.units.filter((item) => item.unitCode !== unit.code)
                                : [
                                    ...lineup.units,
                                    { unitCode: unit.code, carry: false, row: null, column: null, itemCodes: [] },
                                  ],
                            })
                          }
                          className={`rounded-md p-0.5 transition-opacity disabled:opacity-30 ${chosen ? "ring-2 ring-primary" : "opacity-80 hover:opacity-100"}`}
                        >
                          <Thumb src={image(unit.portraitAssetId)} color={COST_COLOR[unit.cost]} />
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </FormBlock>
          <FormBlock
            title="Bàn cờ"
            hint="Chọn một quân rồi bấm ô để đặt; bấm ô có quân khi đang chọn để đổi chỗ. Bấm ô trống lúc chưa chọn sẽ đặt quân chưa xếp đầu tiên."
          >
            <BoardEditor key={lineup.code} lineup={lineup} units={units} image={image} update={update} />
          </FormBlock>
          <FormBlock title="Huy hiệu Phe/Nghề" hint="Huy hiệu từ chúc phúc cộng thêm một vào Phe/Nghề, tối đa 3.">
            <TraitPicker
              traits={content.traits}
              chosen={lineup.emblems}
              orderKey={lineup.code}
              image={image}
              onChange={(emblems) => update({ ...lineup, emblems })}
            />
            {lineup.emblems.length > 0 && (
              <p className="type-meta">
                Đang chọn: {lineup.emblems.map((code) => traits.get(code)?.name ?? code).join(", ")}
              </p>
            )}
          </FormBlock>
          <FormBlock title="Trang bị ưu tiên" hint="Trang bị nên lên trước cho cả đội hình, theo thứ tự; tối đa 6.">
            <OrderedChips
              codes={lineup.priorityItemCodes ?? []}
              describe={itemThumb}
              empty="Chưa chọn trang bị ưu tiên."
              onChange={(priorityItemCodes) => update({ ...lineup, priorityItemCodes })}
            />
            <CodePicker
              label="Chọn trang bị"
              groups={itemGroups}
              chosen={lineup.priorityItemCodes ?? []}
              max={6}
              onToggle={(code) => {
                const codes = lineup.priorityItemCodes ?? []
                update({
                  ...lineup,
                  priorityItemCodes: codes.includes(code) ? codes.filter((entry) => entry !== code) : [...codes, code],
                })
              }}
            />
          </FormBlock>
          <FormBlock title="Chúc phúc ưu tiên" hint="Chúc phúc nên chọn khi đi đội hình này, theo thứ tự; tối đa 5.">
            <OrderedChips
              codes={lineup.blessingCodes}
              describe={(code) => {
                const blessing = blessingByCode.get(code)
                return {
                  name: blessing?.name ?? code,
                  thumb: blessing ? <BlessingThumb src={image(blessing.iconAssetId)} tier={blessing.tier} /> : null,
                }
              }}
              empty="Chưa chọn chúc phúc ưu tiên."
              onChange={(blessingCodes) => update({ ...lineup, blessingCodes })}
            />
            <CodePicker
              label="Chọn chúc phúc"
              groups={blessingGroups}
              chosen={lineup.blessingCodes}
              max={5}
              onToggle={(code) =>
                update({
                  ...lineup,
                  blessingCodes: lineup.blessingCodes.includes(code)
                    ? lineup.blessingCodes.filter((entry) => entry !== code)
                    : [...lineup.blessingCodes, code],
                })
              }
            />
          </FormBlock>
          <FormBlock
            title="Giai đoạn trận"
            hint="Đội hình đầu trận và giữa trận; các quân ở khối Quân cờ phía trên là cuối trận."
          >
            <StageEditor key={lineup.code} lineup={lineup} content={content} image={image} update={update} />
          </FormBlock>
          <FormBlock title="Mô tả và mẹo">
            <label className="grid gap-1">
              <span className="type-label">Điểm mạnh</span>
              <Input
                value={lineup.summary ?? ""}
                placeholder="VD: ST quần thể, ST chiêu bộc phá"
                onChange={(event) => update({ ...lineup, summary: event.target.value || null })}
              />
              <span className="type-meta">
                Một dòng ngắn dưới tên đội hình, như mô tả trong Đề cử đội hình của game.
              </span>
            </label>
            <label className="grid gap-1">
              <span className="type-label">Mẹo</span>
              <Textarea
                className="min-h-24"
                value={lineup.notes ?? ""}
                placeholder="Cách chơi, lên sao quân nào trước, khi nào chuyển hướng…"
                onChange={(event) => update({ ...lineup, notes: event.target.value || null })}
              />
            </label>
          </FormBlock>
        </>
      ) : (
        <p className="type-body text-muted-foreground">Chọn hoặc thêm một đội hình.</p>
      )}
    </MasterDetail>
  )
}
