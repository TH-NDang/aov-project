import type { UserProfile } from "./user-api"

export interface BrowserPreferences {
  languages: readonly string[]
  timeZone?: string
}

export function readBrowserPreferences(): BrowserPreferences {
  let timeZone: string | undefined
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    // Keep the server fallback when the browser cannot resolve its time zone.
  }
  return {
    languages:
      typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language],
    timeZone,
  }
}

export function suggestPreferences(profile: UserProfile, browser: BrowserPreferences): UserProfile {
  let locale = profile.locale
  let timeZone = profile.timeZone
  for (const language of browser.languages) {
    try {
      const canonical = Intl.getCanonicalLocales(language)[0]
      if (canonical && canonical.length <= 35 && /^[a-z]{2}(?:-|$)/.test(canonical)) {
        locale = canonical
        break
      }
    } catch {
      // Try the next preferred language when an entry is malformed.
    }
  }
  if (browser.timeZone && browser.timeZone.length <= 64) {
    try {
      timeZone = new Intl.DateTimeFormat("en", { timeZone: browser.timeZone }).resolvedOptions().timeZone
    } catch {
      // Language and time zone fall back independently.
    }
  }
  return { ...profile, locale, timeZone }
}

export function initialProfileDraft(profile: UserProfile, admin: boolean, browser: BrowserPreferences): UserProfile {
  return !admin && profile.id === null && profile.version === 0 ? suggestPreferences(profile, browser) : profile
}
