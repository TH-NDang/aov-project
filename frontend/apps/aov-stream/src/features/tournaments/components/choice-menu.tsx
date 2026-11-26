import type { ReactElement, ReactNode } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/public-overlay"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import "./choice-menu.css"

export type MenuChoice<Key extends string | null> = {
  key: Key
  name: string
  /** Stands before the name, such as a crest; null keeps the place of one. */
  mark?: ReactNode
  /** Stands at the end of the line, such as the games the choice leaves. */
  note?: string
  /** A part of the choice above it, under which it stands back. */
  part?: boolean
}

/**
 * The choice of one of many behind `children`, the button that names the one in use: a menu under it, or a sheet on
 * phones.
 */
export function ChoiceMenu<Key extends string | null>({
  title,
  align = "end",
  value,
  choices,
  onChoose,
  onCloseAutoFocus,
  children,
}: {
  /** The heading of the sheet. */
  title: string
  align?: "start" | "end"
  value: Key
  choices: MenuChoice<Key>[]
  onChoose: (key: Key) => void
  /** Where the focus goes as the menu closes, when not back to the button. */
  onCloseAutoFocus?: (event: Event) => void
  children: ReactElement
}) {
  const { text } = useStreamLocale()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={6}
        collisionPadding={12}
        className="hub-popover tn-choice-menu"
        drawerTitle={title}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {choices.map(({ key, name, mark, note, part }) => (
          <DropdownMenuItem key={key ?? ""} className="hub-menu-item" onSelect={() => onChoose(key)}>
            <span className="tn-choice-menu-row" data-part={part || undefined} data-chosen={key === value || undefined}>
              {mark !== undefined && <i aria-hidden="true">{mark}</i>}
              <span>{name}</span>
              {note && <small>{note}</small>}
              <StreamIcon name="check" size={16} />
              {/* The check is only seen, and an item of the shared menu takes no state of its own: words tell it. */}
              {key === value && <span className="sr-only">{text("(đang chọn)", "(chosen)")}</span>}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
