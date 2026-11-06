import { useEffect, useRef, useSyncExternalStore } from "react"

const SAVE_RETRY_DELAY = 1000

/**
 * A setting that belongs to the reader, such as a time zone or a currency. It works signed out through this browser's
 * storage and, once signed in, follows the profile shared across the apps.
 */
export function createAccountPreference({
  storageKey,
  read,
  accountValue,
}: {
  storageKey: string
  /** Turns a stored or chosen value into the form the preference keeps; anything unusable becomes null. */
  read: (value: unknown) => string | null
  /** What a profile holds when the reader stops choosing, since a profile always holds a concrete value once set. */
  accountValue: () => string
}) {
  let choice: string | null | undefined
  const listeners = new Set<() => void>()
  let accountSaver: ((value: string) => Promise<unknown>) | null = null
  let savingToAccount: Promise<void> | null = null
  let valueToSave: string | null = null
  let saveFailed = false
  let listeningToOtherTabs = false

  function readStoredChoice() {
    try {
      if (typeof localStorage === "undefined") return null
      return read(localStorage.getItem(storageKey))
    } catch {
      return null
    }
  }

  function publishChoice(next: string | null) {
    if (choice === next) return
    choice = next
    listeners.forEach((listener) => listener())
  }

  function storeChoice(next: string | null) {
    try {
      if (typeof localStorage !== "undefined") {
        if (next) localStorage.setItem(storageKey, next)
        else localStorage.removeItem(storageKey)
      }
    } catch {
      // The choice lasts for this page when storage is unavailable.
    }
    publishChoice(next)
  }

  function subscribe(listener: () => void) {
    listeners.add(listener)
    if (!listeningToOtherTabs && typeof window !== "undefined") {
      listeningToOtherTabs = true
      window.addEventListener("storage", (event) => {
        if (event.key === null || event.key === storageKey) publishChoice(readStoredChoice())
      })
    }
    return () => {
      listeners.delete(listener)
    }
  }

  /** The value the user picked, or null while they follow their device. */
  function currentChoice() {
    if (choice === undefined) choice = readStoredChoice()
    return choice
  }

  function publishSaveFailed(next: boolean) {
    if (saveFailed === next) return
    saveFailed = next
    listeners.forEach((listener) => listener())
  }

  /** Tries twice, since most failures here are a passing network error. A newer choice replaces the retry. */
  async function saveWithRetry(value: string) {
    for (let attempt = 0; ; attempt++) {
      try {
        await accountSaver?.(value)
        return true
      } catch {
        if (attempt > 0 || valueToSave) return false
        await new Promise((resolve) => setTimeout(resolve, SAVE_RETRY_DELAY))
        if (valueToSave) return false
      }
    }
  }

  /** One write at a time, newest choice last: a profile version only fits one write, so overlapping saves would conflict. */
  function saveToAccount(value: string) {
    valueToSave = value
    savingToAccount ??= (async () => {
      let saved = true
      while (valueToSave) {
        const current = valueToSave
        valueToSave = null
        saved = await saveWithRetry(current)
      }
      savingToAccount = null
      publishSaveFailed(!saved)
    })()
    return savingToAccount
  }

  /** Applies a choice from a settings control at once, keeps it across visits and saves it to a signed-in profile. */
  async function choose(value: string | null) {
    const next = read(value)
    storeChoice(next)
    publishSaveFailed(false)
    if (accountSaver) await saveToAccount(next ?? accountValue())
  }

  /**
   * Connects the signed-in profile: a value saved there replaces this browser's choice when it loads or changes, and a
   * new choice is written back through `save`. Without a writable profile a choice stays in this browser.
   */
  function useAccount(
    saved: string | null | undefined,
    writableProfile: boolean,
    save?: (value: string) => Promise<unknown>,
  ) {
    const latestSave = useRef(save)
    latestSave.current = save
    useEffect(() => {
      // While a choice is on its way to the profile, the profile still holds an older one.
      const value = read(saved)
      if (value && !savingToAccount) storeChoice(value)
    }, [saved])
    const writable = writableProfile && !!save
    useEffect(() => {
      if (!writable) return
      const saver = (value: string) => latestSave.current?.(value) ?? Promise.resolve()
      accountSaver = saver
      return () => {
        if (accountSaver === saver) accountSaver = null
        publishSaveFailed(false)
      }
    }, [writable])
  }

  const currentSaveFailed = () => saveFailed

  return {
    subscribe,
    choice: currentChoice,
    useChoice: () => useSyncExternalStore(subscribe, currentChoice, currentChoice),
    saveFailed: currentSaveFailed,
    useSaveFailed: () => useSyncExternalStore(subscribe, currentSaveFailed, currentSaveFailed),
    choose,
    useAccount,
  }
}
