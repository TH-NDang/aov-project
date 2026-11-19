import type { ReactNode } from "react"
import { ListVideo, Plus, Users } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import type { FocusedGameParts } from "./focused-game"

export type PhoneTab = "feed" | "board"

const PHONE_TABS = [
  { id: "feed", label: "Diễn biến", icon: ListVideo },
  { id: "board", label: "Bảng điểm", icon: Users },
] as const

/**
 * Where the focused game's parts go on the match page. A wide screen shows the score card and the feed beside the
 * scoreboard; a phone shows the feed or the scoreboard as tabs, and records from a floating button.
 */
export function FocusedGameLayout({
  parts,
  phone,
  gameCard,
  tab,
  onTab,
  showFab,
  onCompose,
}: {
  parts: FocusedGameParts
  phone: boolean
  gameCard: ReactNode
  tab: PhoneTab
  onTab: (tab: PhoneTab) => void
  /** Phones record moments from a floating action button, which the floating player must not cover. */
  showFab: boolean
  onCompose: () => void
}) {
  if (phone)
    return (
      <>
        <div className="esp-area-side min-w-0 space-y-3">
          <nav className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" aria-label="Nội dung ván">
            {PHONE_TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={tab === entry.id}
                onClick={() => onTab(entry.id)}
                className={cn(
                  "flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition",
                  tab === entry.id ? "bg-background shadow-sm" : "text-muted-foreground",
                )}
              >
                <entry.icon size={14} /> {entry.label}
              </button>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            {parts.status}
            {parts.focusChip}
          </div>
          {tab === "feed" && parts.feed("h-[65vh]")}
          {tab === "board" && parts.board}
          {parts.publishedNote}
        </div>
        {showFab && (
          <button
            type="button"
            onClick={onCompose}
            className="fixed right-5 bottom-5 z-30 grid size-14 place-items-center rounded-full bg-[var(--esp-gold)] text-[var(--esp-ink)] shadow-xl"
            aria-label="Ghi sự kiện"
          >
            <Plus size={24} />
          </button>
        )}
        {parts.popups}
      </>
    )
  return (
    <>
      <div className="esp-area-side flex min-h-[380px] min-w-0 flex-col gap-2">
        {gameCard}
        {(parts.status || parts.focusChip) && (
          <div className="flex flex-wrap items-center gap-2">
            {parts.status}
            {parts.focusChip}
          </div>
        )}
        <div className="relative min-h-[320px] flex-1">{parts.feed("absolute inset-0")}</div>
      </div>
      <div className="esp-area-board min-w-0 space-y-3">
        {parts.board}
        {parts.publishedNote}
      </div>
      {parts.popups}
    </>
  )
}
