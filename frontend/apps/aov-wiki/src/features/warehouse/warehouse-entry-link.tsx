import type { ComponentProps, MouseEvent } from "react"
import { useWikiContext } from "../../context/wiki-context"
import { warehousePath } from "../../lib/wiki-catalog"
import type { WarehouseEntry, WarehouseKind } from "../../lib/warehouse-types"

type EntryLinkProps = Omit<ComponentProps<"a">, "href" | "onClick"> & {
  kind: WarehouseKind
  entry: WarehouseEntry
  selected: boolean
  onOpen: (entry: WarehouseEntry, element: HTMLElement) => void
}

/**
 * One entry of a catalog. It is a real link to the entry's own page, so crawlers reach every entry and a reader can
 * open one in a new tab; a plain click opens the panel in place, as before.
 */
export function WarehouseEntryLink({ kind, entry, selected, onOpen, children, ...props }: EntryLinkProps) {
  const { href } = useWikiContext()
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onOpen(entry, event.currentTarget)
  }
  return (
    <a
      {...props}
      href={href(warehousePath(kind, entry.code))}
      aria-current={selected ? "true" : undefined}
      onClick={open}
    >
      {children}
    </a>
  )
}
