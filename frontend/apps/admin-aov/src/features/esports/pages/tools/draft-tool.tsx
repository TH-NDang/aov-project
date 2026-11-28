import { useMemo, useState } from "react"
import type { GameContent, Side } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { BAN_FACE } from "@aov/ui/components/draft-marks"
import { confirmAction } from "@/components/confirm-dialog"
import { DraftBoard, UsedHeroes, turnWords, type BoardSlot } from "../../components/game/draft-board"
import { HeroIcon } from "../../components/primitives"
import { DRAFT_ORDER, draftSlots, lacksTurns, type DraftedHero } from "../../model/draft"
import { referenceIndex } from "../../model/game-view"
import { heroKeys } from "../../model/series-rules"
import type { KeptChanges } from "../desk-changes"
import { LoadError } from "../esports-shell"
import type { GameDesk } from "../game-desk"
import { useDraftRecorder, type DraftRecorder } from "./draft-recorder"
import { TurnList } from "./draft-turns"
import { TurnPicker } from "./turn-picker"

/**
 * The board of bans and picks with, while recording, the turn to type and the heroes it may take. `kept` is how the foot
 * tells, and Ctrl Z takes back, the turns of an imported game that are kept in this browser until they are saved.
 */
export function DraftTool({ desk, kept }: { desk: GameDesk; kept?: KeptChanges }) {
  const recorder = useDraftRecorder(desk, kept)
  const { content, draft, collecting } = recorder
  const { editable, view, locks } = desk
  const icon = useMemo(() => referenceIndex(desk.heroes), [desk.heroes])
  const [selected, setSelected] = useState<number | null>(null)
  const next = draft.turns.length
  // Line-ups without an order have no turns to draw; while those are typed, the board shows what is typed.
  const slots = lacksTurns(content) && !collecting ? recordedSlots(content, icon) : turnSlots(draft, icon)
  const chosen = selected !== null && selected < next ? selected : null
  const open = chosen !== null || next < slots.length

  return (
    <div className="esp-two">
      <div>
        <DraftBoard
          game={view}
          slots={slots}
          next={editable && chosen === null ? next : null}
          selected={chosen}
          locks={locks}
          onSelect={editable ? (index) => setSelected(index === chosen || index >= next ? null : index) : undefined}
          onSwapSides={editable ? () => void recorder.swap() : undefined}
        />
        <UsedHeroes game={view} locks={locks} icon={icon} />
      </div>
      <div className="esp-draft-right">
        {!editable ? (
          <TurnList desk={desk} slots={slots} />
        ) : (
          <>
            {collecting && <Collecting desk={desk} recorder={recorder} icon={icon} />}
            {!open ? (
              <p className="esp-draft-line-note">Đã đủ {next} lượt.</p>
            ) : desk.catalogError ? (
              <div className="p-3">
                <LoadError error={desk.catalogError} onRetry={desk.reloadCatalog} />
              </div>
            ) : !desk.catalog ? (
              <p className="esp-draft-line-note" role="status">
                Đang tải danh mục của ván…
              </p>
            ) : (
              <TurnPicker
                desk={desk}
                recorder={recorder}
                index={chosen ?? next}
                recorded={chosen !== null}
                onDone={() => setSelected(null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** Turns typed so far followed by those the usual order still has. */
const turnSlots = (draft: DraftRecorder["draft"], icon: ReturnType<typeof referenceIndex>): BoardSlot[] =>
  draftSlots(draft).map((slot, index) => ({
    index,
    order: index + 1,
    kind: slot.kind,
    side: slot.side,
    hero: icon(slot.hero),
    recorded: slot.recorded,
  }))

const recordedSlots = (content: GameContent, icon: ReturnType<typeof referenceIndex>): BoardSlot[] =>
  content.sides
    .flatMap(({ side, bans, participants }) => [
      ...bans.map((hero) => ({ side, kind: "BAN" as const, hero: icon(hero) })),
      ...participants.map(({ hero }) => ({ side, kind: "PICK" as const, hero: icon(hero) })),
    ])
    .map((slot, index) => ({ ...slot, index, order: null, recorded: !!slot.hero }))

const SIDES: readonly Side[] = ["BLUE", "RED"]

const heroWords = (entry: DraftedHero, desk: GameDesk) =>
  `${desk.view.sides[entry.side].team.shortName} ${turnWords(entry.kind)} ${entry.hero.name}`

/**
 * What is collected for a game without turns: the bans and heroes it holds that no typed turn names yet, by team, and
 * the ways out once 18 turns are typed.
 */
function Collecting({
  desk,
  recorder,
  icon,
}: {
  desk: GameDesk
  recorder: DraftRecorder
  icon: ReturnType<typeof referenceIndex>
}) {
  const { draft, missing } = recorder
  const typed = draft.turns.length
  const full = typed >= DRAFT_ORDER.length
  const save = async () => {
    // Every recorded hero has its turn after a turn taken back, so the turns are saved as they stand.
    if (!missing.length) return recorder.saveCollected(draft.turns)
    const accepted = await confirmAction({
      title: `Lưu theo ${typed} lượt?`,
      description: `Không lượt nào nhắc tới ${missing.map((entry) => heroWords(entry, desk)).join(", ")}. Lưu thì ván bỏ các tướng này.`,
      confirmLabel: `Lưu theo ${typed} lượt`,
    })
    if (accepted) await recorder.saveCollected(draft.turns)
  }
  const dropAll = async () => {
    const accepted = await confirmAction({
      title: `Bỏ ${typed} lượt vừa nhập?`,
      description: "Các lượt này mới chỉ ở trên trình duyệt. Tướng đã ghi của ván không đổi.",
      confirmLabel: `Bỏ ${typed} lượt`,
    })
    if (accepted) recorder.drop()
  }
  return (
    <div className="esp-draft-line-note space-y-2" data-collecting>
      <p>
        Ván này chưa có thứ tự cấm chọn. Ghi đủ 18 lượt thì lưu một lần; tướng đã ghi được giữ.{" "}
        {typed > 0 && (
          <button type="button" className="esp-draft-drop" onClick={() => void dropAll()}>
            Bỏ {typed} lượt vừa nhập
          </button>
        )}
      </p>
      {missing.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Tướng đã ghi chưa có lượt">
          <span>Chưa có lượt:</span>
          {SIDES.map((side) => {
            const own = missing.filter((entry) => entry.side === side)
            if (!own.length) return null
            return (
              <span key={side} className="inline-flex flex-wrap items-center gap-1">
                <b className="font-semibold text-foreground">{desk.view.sides[side].team.shortName}</b>
                {own.map((entry) => (
                  <span
                    key={`${entry.kind}-${heroKeys(entry.hero)[0]}`}
                    className={entry.kind === "BAN" ? `inline-flex rounded-md ${BAN_FACE}` : "inline-flex rounded-md"}
                  >
                    <HeroIcon hero={icon(entry.hero)} size={22} title={heroWords(entry, desk)} className="rounded-md" />
                  </span>
                ))}
              </span>
            )
          })}
        </p>
      )}
      {full && (
        <Button type="button" size="sm" variant="outline" onClick={() => void save()}>
          {missing.length ? `Lưu theo ${typed} lượt` : `Lưu ${typed} lượt`}
        </Button>
      )}
    </div>
  )
}
