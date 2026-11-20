import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { CommandMenu } from "./command-menu"
import { useHotkeys } from "../hotkeys"

const CommandSearchContext = createContext<{ open: () => void }>({ open: () => {} })

/** One search for the whole Admin: Ctrl K anywhere, or the search row at the top of the sidebar and the phone bar. */
export function CommandSearchProvider({ children }: { children: ReactNode }) {
  const { enabled } = useHotkeys()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!enabled) return
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled])

  const value = useMemo(() => ({ open: () => setOpen(true) }), [])
  return (
    <CommandSearchContext.Provider value={value}>
      {children}
      <CommandMenu open={open} onOpenChange={setOpen} />
    </CommandSearchContext.Provider>
  )
}

export function useCommandSearch() {
  return useContext(CommandSearchContext)
}
