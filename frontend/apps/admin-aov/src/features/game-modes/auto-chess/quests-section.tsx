import { useMemo } from "react"
import { ArrowDown, ArrowUp, Copy, ListPlus, Plus, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { confirmAction } from "@/components/confirm-dialog"
import { RowMenu, SuggestInput } from "../entry-controls"
import type { GuideContent } from "../game-mode-api"
import { type SectionProps, swapAt, moveAt } from "./guide-model"

export function QuestsSection({ content, setContent }: Pick<SectionProps, "content" | "setContent">) {
  const quests = content.quests
  const set = (next: GuideContent["quests"]) => setContent({ ...content, quests: next })
  const update = (at: number, next: GuideContent["quests"][number]) => set(swapAt(quests, at, next))
  const blank = () => {
    const taken = new Set(quests.map((quest) => quest.code))
    let number = quests.length + 1
    while (taken.has(`nhiem-vu-${number}`)) number++
    return { code: `nhiem-vu-${number}`, task: "", reward: null }
  }
  // Rewards written most often come first.
  const rewards = useMemo(() => {
    const counts = new Map<string, number>()
    for (const quest of quests) if (quest.reward) counts.set(quest.reward, (counts.get(quest.reward) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1]).map(([reward]) => reward)
  }, [quests])
  return (
    <section className="grid gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="type-section-title">
          Nhiệm vụ <span className="type-meta">{quests.length}</span>
        </h2>
        <Button type="button" size="sm" variant="outline" onClick={() => set([...quests, blank()])}>
          <Plus /> Thêm nhiệm vụ
        </Button>
      </div>
      <p className="type-meta">Ô phần thưởng gợi ý các phần thưởng đã ghi; bấm ⋯ để chuyển chỗ, nhân bản hoặc xóa.</p>
      <div className="grid grid-cols-[32px_minmax(0,3fr)_minmax(0,1.4fr)_auto] items-center gap-x-2 gap-y-1.5">
        <span />
        <span className="type-label">Nhiệm vụ</span>
        <span className="type-label">Phần thưởng</span>
        <span />
        {quests.map((quest, at) => (
          <div key={at} className="contents">
            <span className="type-meta grid size-7 place-items-center rounded-full bg-muted">{at + 1}</span>
            <Input
              aria-label={`Nhiệm vụ ${at + 1}`}
              value={quest.task}
              onChange={(event) => update(at, { ...quest, task: event.target.value })}
            />
            <SuggestInput
              label={`Phần thưởng nhiệm vụ ${at + 1}`}
              heading="Phần thưởng đã ghi"
              placeholder="vd. 2 vàng"
              value={quest.reward ?? ""}
              suggestions={rewards}
              onChange={(reward) => update(at, { ...quest, reward: reward || null })}
            />
            <RowMenu
              label={`Tùy chọn cho nhiệm vụ ${at + 1}`}
              actions={[
                {
                  label: "Lên trên",
                  icon: <ArrowUp />,
                  disabled: at === 0,
                  onSelect: () => set(moveAt(quests, at, -1)),
                },
                {
                  label: "Xuống dưới",
                  icon: <ArrowDown />,
                  disabled: at === quests.length - 1,
                  onSelect: () => set(moveAt(quests, at, 1)),
                },
                {
                  label: "Thêm nhiệm vụ bên dưới",
                  icon: <ListPlus />,
                  onSelect: () => set([...quests.slice(0, at + 1), blank(), ...quests.slice(at + 1)]),
                },
                {
                  label: "Nhân bản",
                  icon: <Copy />,
                  onSelect: () =>
                    set([...quests.slice(0, at + 1), { ...quest, code: blank().code }, ...quests.slice(at + 1)]),
                },
                {
                  label: "Xóa",
                  icon: <Trash2 />,
                  destructive: true,
                  apart: true,
                  onSelect: async () => {
                    if (
                      await confirmAction({
                        title: `Xóa nhiệm vụ ${at + 1}?`,
                        description: "Nhiệm vụ sẽ bị xóa khỏi bản nháp. Bạn vẫn có thể bỏ nháp để lấy lại.",
                        confirmLabel: "Xóa",
                      })
                    )
                      set(quests.filter((_, index) => index !== at))
                  },
                },
              ]}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
