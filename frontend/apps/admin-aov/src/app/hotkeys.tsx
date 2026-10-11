import * as React from "react"
import { createContext, useContext, useState, type ReactNode } from "react"

const STORAGE_KEY = "aov-admin:hotkeys-enabled"
const HotkeysContext = createContext({ enabled: true, setEnabled: (_enabled: boolean) => {} })

export function HotkeysProvider({ children }: { children: ReactNode }) {
  const [enabled, updateEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== "false"
    } catch {
      return true
    }
  })
  const setEnabled = (value: boolean) => {
    updateEnabled(value)
    try {
      localStorage.setItem(STORAGE_KEY, String(value))
    } catch {
      /* Preferences still work for this session. */
    }
  }
  return React.createElement(HotkeysContext.Provider, { value: { enabled, setEnabled } }, children)
}

export const useHotkeys = () => useContext(HotkeysContext)
