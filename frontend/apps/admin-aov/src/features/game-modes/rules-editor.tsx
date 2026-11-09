import { useState } from "react"
import { ArrowDown, ArrowUp, Check, Copy, FolderInput, PencilLine, Plus, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Textarea } from "@aov/ui/components/textarea"
import { confirmAction } from "@/components/confirm-dialog"
import { RowMenu, SuggestInput } from "./entry-controls"
import type { RuleSection } from "./game-mode-api"

/** Moves one rule past its neighbour in the same group; rules of other groups keep their places. */
function moveWithin(rules: RuleSection[], at: number, delta: -1 | 1) {
  const group = rules[at].group ?? ""
  const same = rules.flatMap((rule, index) => ((rule.group ?? "") === group ? [index] : []))
  const target = same[same.indexOf(at) + delta]
  if (target === undefined) return rules
  const next = [...rules]
  ;[next[at], next[target]] = [next[target], next[at]]
  return next
}

/** A group's name as a title; the pencil turns it into a box that renames every rule of the group. */
function GroupName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  if (draft === null)
    return (
      <span className="flex min-w-0 items-center gap-1">
        <h4 className="type-label truncate">{name || "Chưa có nhóm"}</h4>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`Đổi tên nhóm ${name || "chưa có nhóm"}`}
          title="Đổi tên nhóm"
          onClick={() => setDraft(name)}
        >
          <PencilLine />
        </Button>
      </span>
    )
  const commit = () => {
    if (draft.trim() !== name) onRename(draft.trim())
    setDraft(null)
  }
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(event) => {
        event.preventDefault()
        commit()
      }}
    >
      <Input
        autoFocus
        aria-label="Tên nhóm"
        className="h-8 w-64"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && setDraft(null)}
      />
      <Button type="submit" size="icon-sm" variant="ghost" aria-label="Lưu tên nhóm">
        <Check />
      </Button>
    </form>
  )
}

/**
 * Rules grouped the way readers see them. Each rule reads as a title and a short preview; the pencil opens it, and the
 * menu moves, copies, regroups or removes it.
 */
export function RulesEditor({ rules, onChange }: { rules: RuleSection[]; onChange: (rules: RuleSection[]) => void }) {
  const [editing, setEditing] = useState<number | null>(null)
  const groups = [...new Set(rules.map((rule) => rule.group ?? ""))]
  const named = groups.filter(Boolean)
  const update = (at: number, next: RuleSection) => onChange(rules.map((rule, index) => (index === at ? next : rule)))
  const insertAfter = (at: number, rule: RuleSection) => {
    onChange([...rules.slice(0, at + 1), rule, ...rules.slice(at + 1)])
    setEditing(at + 1)
  }

  return (
    <div className="grid gap-3">
      {groups.map((group) => {
        const entries = rules.flatMap((rule, at) => ((rule.group ?? "") === group ? [{ rule, at }] : []))
        const last = entries[entries.length - 1]?.at ?? rules.length - 1
        return (
          <section key={group || "none"} className="grid gap-1.5 rounded-lg border bg-muted/20 p-2">
            <header className="flex flex-wrap items-center justify-between gap-2 px-1">
              <span className="flex min-w-0 items-center gap-2">
                <GroupName
                  name={group}
                  onRename={(name) =>
                    onChange(
                      rules.map((rule) => ((rule.group ?? "") === group ? { ...rule, group: name || null } : rule)),
                    )
                  }
                />
                <span className="type-meta">{entries.length} luật</span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => insertAfter(last, { group: group || null, title: "", body: "" })}
              >
                <Plus /> Thêm luật
              </Button>
            </header>
            <ol className="grid gap-1">
              {entries.map(({ rule, at }, position) =>
                editing === at ? (
                  <li key={at} className="grid gap-2 rounded-md border border-primary/50 bg-card p-2">
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <label className="grid gap-1">
                        <span className="type-label">Tiêu đề</span>
                        <Input
                          autoFocus
                          value={rule.title}
                          onChange={(event) => update(at, { ...rule, title: event.target.value })}
                        />
                      </label>
                      <div className="grid gap-1">
                        <span className="type-label">Nhóm</span>
                        <SuggestInput
                          label="Nhóm"
                          heading="Nhóm đang có"
                          value={rule.group ?? ""}
                          suggestions={named}
                          onChange={(value) => update(at, { ...rule, group: value || null })}
                        />
                      </div>
                    </div>
                    <label className="grid gap-1">
                      <span className="type-label">Nội dung</span>
                      <Textarea
                        className="min-h-28"
                        value={rule.body ?? ""}
                        onChange={(event) => update(at, { ...rule, body: event.target.value })}
                      />
                    </label>
                    <div className="flex justify-end">
                      <Button type="button" size="sm" onClick={() => setEditing(null)}>
                        <Check /> Xong
                      </Button>
                    </div>
                  </li>
                ) : (
                  <li key={at} className="flex items-start gap-1 rounded-md border bg-card py-1.5 pr-1 pl-3">
                    <button
                      type="button"
                      className="grid min-w-0 flex-1 gap-0.5 py-0.5 text-left"
                      onClick={() => setEditing(at)}
                    >
                      <span className="type-body truncate">
                        <strong>{rule.title || "(chưa có tiêu đề)"}</strong>
                      </span>
                      {rule.body && <span className="type-meta line-clamp-2 whitespace-pre-line">{rule.body}</span>}
                    </button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Sửa luật ${rule.title}`}
                      title="Sửa"
                      onClick={() => setEditing(at)}
                    >
                      <PencilLine />
                    </Button>
                    <RowMenu
                      label={`Tùy chọn cho luật ${rule.title}`}
                      actions={[
                        {
                          label: "Lên trên",
                          icon: <ArrowUp />,
                          disabled: position === 0,
                          onSelect: () => onChange(moveWithin(rules, at, -1)),
                        },
                        {
                          label: "Xuống dưới",
                          icon: <ArrowDown />,
                          disabled: position === entries.length - 1,
                          onSelect: () => onChange(moveWithin(rules, at, 1)),
                        },
                        {
                          label: "Chuyển nhóm",
                          icon: <FolderInput />,
                          choices: named.map((name) => ({
                            label: name,
                            current: name === group,
                            onSelect: () => update(at, { ...rule, group: name }),
                          })),
                        },
                        {
                          label: "Nhân bản",
                          icon: <Copy />,
                          onSelect: () => insertAfter(at, { ...rule, title: `${rule.title} (bản sao)` }),
                        },
                        {
                          label: "Xóa",
                          icon: <Trash2 />,
                          destructive: true,
                          apart: true,
                          onSelect: async () => {
                            if (
                              await confirmAction({
                                title: `Xóa luật ${rule.title || "này"}?`,
                                description: "Luật sẽ bị xóa khỏi bản nháp. Bạn vẫn có thể bỏ nháp để lấy lại.",
                                confirmLabel: "Xóa",
                              })
                            ) {
                              onChange(rules.filter((_, index) => index !== at))
                              setEditing(null)
                            }
                          },
                        },
                      ]}
                    />
                  </li>
                ),
              )}
            </ol>
          </section>
        )
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="justify-self-start"
        onClick={() => insertAfter(rules.length - 1, { group: "Nhóm mới", title: "", body: "" })}
      >
        <Plus /> Thêm nhóm luật
      </Button>
    </div>
  )
}
