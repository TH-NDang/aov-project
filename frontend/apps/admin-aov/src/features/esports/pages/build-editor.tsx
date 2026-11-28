import { useEffect, useId, useMemo, useRef, useState } from "react"
import type { BuildRole, BuildRoles, BuildStep, Participant, Selection } from "@aov/community-contracts"
import { Camera, RotateCcw, TriangleAlert } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Checkbox } from "@aov/ui/components/checkbox"
import { confirmAction } from "@/components/confirm-dialog"
import { formatClock } from "@/lib/clock"
import { BuildEnd } from "../components/game/build-end"
import { BuildPath, type OpenPart } from "../components/game/build-path"
import { BuildStepMenu, type ApplyEdit } from "../components/game/build-step-menu"
import {
  BUILD_REFUSALS,
  addItem,
  buildOf,
  buildProblems,
  buildRole,
  editBuild,
  itemKey,
  itemName,
  refused,
  seenItems,
  setRole,
  type BuildRefusal,
  type ItemIndex,
} from "../model/build"

/**
 * The items a player built, in the order they were bought, each for the build itself or for protection; the six slots
 * the game ended with are read from them. Every edit is a change to the list the player has when it is saved; while
 * nobody wrote one, that is what the snapshot at the end of the game shows, so the first edit writes a list of its own.
 */
export function BuildEditor({
  participant,
  index,
  roles,
  duration,
  nowGame,
  stamp,
  inline,
  onStamp,
  onSeekGame,
  onEdit,
}: {
  participant: Participant
  index: ItemIndex
  /** The role last recorded for each item, for this hero first: what an added item is bought for unless changed. */
  roles?: BuildRoles
  /** How long the game lasted, when known. */
  duration?: number | null
  /** The game second the video is at, when a synced video plays beside the editor. */
  nowGame?: number | null
  /** Items are added with the time of the video; kept by the panel, so it holds from one player to the next. */
  stamp: boolean
  /** The catalogue opens under its list, on a screen without room beside it. */
  inline?: boolean
  onStamp: (stamp: boolean) => void
  onSeekGame?: (gameSecond: number) => void
  /** Writes an edit; `text` says what it did, without the player. */
  onEdit: (change: (participant: Participant) => Participant, text: string) => void
}) {
  const build = useMemo(() => buildOf(participant, duration, index), [participant, duration, index])
  const problems = useMemo(() => buildProblems(build.steps, duration, index), [build.steps, duration, index])
  const seen = useMemo(
    () => seenItems(participant, duration, build.steps, index),
    [participant, duration, build.steps, index],
  )
  const [open, setOpen] = useState<OpenPart | null>(null)
  const stampId = useId()
  const root = useRef<HTMLElement>(null)
  const focusNext = useRef<string | null>(null)
  const own = !!participant.build?.length
  // What the list would be read from again without a list of the player's own.
  const beneath = own ? buildOf({ ...participant, build: [] }, duration, index).snapshot : null
  // Before the game starts and after it ended the video shows no moment of it.
  const now = nowGame && (duration == null || nowGame <= duration) ? nowGame : null

  // The item a menu was opened on is gone once it went into another or was taken out, and the focus with it.
  useEffect(() => {
    if (focusNext.current == null) return
    const items = [...(root.current?.querySelectorAll<HTMLElement>("[data-item]") ?? [])]
    const next = items.find((item) => item.dataset.item === focusNext.current)
    focusNext.current = null
    ;(next ?? root.current?.querySelector<HTMLElement>("[data-add]"))?.focus({ preventScroll: true })
  })

  const edit: ApplyEdit = (change, text) => {
    const next = editBuild(participant, duration, change, index)
    if (refused(next)) return next
    if (next === participant) return null
    onEdit(
      (current) => {
        const result = editBuild(current, duration, change, index)
        return refused(result) ? current : result
      },
      // The first edit also makes the list the player's own.
      own || !build.snapshot ? text : `${text}, ghi thành danh sách riêng`,
    )
    return null
  }
  const readAgain = async () => {
    const confirmed = await confirmAction({
      title: "Bỏ danh sách trang bị đã ghi?",
      description: `${build.steps.length} món đã ghi của tuyển thủ này sẽ bị bỏ. Trang bị lại đọc từ mốc ${formatClock(beneath?.atSeconds)}.`,
      confirmLabel: "Bỏ danh sách",
    })
    if (confirmed) onEdit((current) => ({ ...current, build: [] }), "Đã bỏ danh sách trang bị riêng")
  }
  // An item added now is given the second the video is at, while that is asked for.
  const stampAt = stamp ? now : null
  const pick = (item: Selection, seenAt: number | null, replaces: Selection[] = []): BuildRefusal | null => {
    const name = itemName(item, index)
    const id = index.find(item)?.id ?? item.id
    const remembered = id ? roles?.items[id] : undefined
    const role: BuildRole = remembered ?? "CORE"
    const sold = replaces.map((gone) => itemName(gone, index))
    const done = [
      `Đã thêm ${name}`,
      sold.length ? `bán ${sold.join(" và ")} để lấy` : null,
      remembered === "PROTECTIVE" ? "bảo hộ như lần ghi trước" : null,
    ]
    return edit(
      (steps) => addItem(steps, item, role, index, seenAt ?? stampAt, replaces),
      done.filter(Boolean).join(", "),
    )
  }
  const changeRole = (step: BuildStep, role: BuildRole) => {
    const key = itemKey(step.item, index)
    const name = itemName(step.item, index)
    edit((steps) => setRole(steps, key, role, index), `${name} là đồ ${buildRole(role).label.toLowerCase()}`)
  }
  const stampBox = now != null && (
    <label
      htmlFor={stampId}
      data-keep-catalogue
      className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"
      title="Món thêm vào nhận thời điểm video đang ở"
      // A press of the words would hand the focus to the box with the label's own click, so they turn it by hand.
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("button")) return
        event.preventDefault()
        onStamp(!stamp)
      }}
    >
      <Checkbox id={stampId} checked={stamp} onCheckedChange={(checked) => onStamp(checked === true)} />
      Ghi kèm lúc video {formatClock(now)}
    </label>
  )

  return (
    <section ref={root} data-part="equipment" className="@container space-y-4" aria-label="Trang bị đã lên">
      {build.snapshot && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b pb-3 text-xs">
          <p className="flex min-w-0 flex-1 basis-64 items-start gap-2" data-source="snapshot">
            <Camera size={14} className="mt-px shrink-0 text-muted-foreground" aria-hidden="true" />
            <span title={build.leftOut ? "Món cấp 1 và món mua lặp lại không vào danh sách" : undefined}>
              Đang đọc từ mốc {formatClock(build.snapshot.atSeconds)}
              {build.leftOut > 0 && `, bỏ qua ${build.leftOut} ô`}. Sửa một món là ghi thành danh sách riêng.
            </span>
          </p>
          <Button size="xs" variant="outline" onClick={() => void edit((steps) => [...steps], "Đã ghi trang bị")}>
            Ghi danh sách này
          </Button>
        </div>
      )}
      <BuildEnd
        steps={build.steps}
        index={index}
        borrowed={!!build.snapshot}
        aside={
          beneath && (
            <Button
              size="xs"
              variant="ghost"
              className="ml-auto text-muted-foreground"
              title="Bỏ danh sách đã ghi, trang bị lại đọc từ mốc"
              onClick={() => void readAgain()}
            >
              <RotateCcw aria-hidden /> Đọc lại từ mốc {formatClock(beneath.atSeconds)}
            </Button>
          )
        }
      />
      <BuildPath
        steps={build.steps}
        index={index}
        problems={new Set(problems.map((problem) => problem.step))}
        seen={seen}
        now={stampAt}
        heading={stampBox}
        inline={inline}
        open={open}
        onOpen={setOpen}
        onClose={(part) => setOpen((current) => (current === part ? null : current))}
        onPick={pick}
        onRole={changeRole}
        menu={(step) => (
          <BuildStepMenu
            step={step}
            steps={build.steps}
            index={index}
            duration={duration}
            nowGame={now}
            stamp={stampAt}
            onSeek={onSeekGame}
            onEdit={edit}
            onClose={(next = "") => {
              focusNext.current = next
              setOpen(null)
            }}
          />
        )}
      />
      {problems.length > 0 && (
        <ul className="space-y-1 text-xs" aria-label="Cần sửa">
          {problems.map(({ step, reason }, position) => (
            <li key={position} className="flex items-center gap-1.5">
              <TriangleAlert size={14} className="shrink-0 text-(--aov-warning)" aria-hidden="true" />
              <span>
                <span className="font-semibold">{itemName(step.item, index)}</span>: {BUILD_REFUSALS[reason]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
