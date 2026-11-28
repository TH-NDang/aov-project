import { createAccountPreference } from "@aov/ui/lib/account-preference"

const preference = createAccountPreference({
  storageKey: "aov:auto-translate:v1",
  read: (value) => (value === "on" || value === true ? "on" : value === "off" || value === false ? "off" : null),
  accountValue: () => "off",
})

/** Whether Stream translates posts into the reader's language without being asked (ADR-037). Off until chosen. */
export const autoTranslateOn = () => preference.choice() === "on"

export const useAutoTranslate = () => preference.useChoice() === "on"

export const useAutoTranslateSaveFailed = preference.useSaveFailed

/** Applies the choice at once, keeps it in this browser and saves it to a signed-in profile. */
export const chooseAutoTranslate = (on: boolean) => preference.choose(on ? "on" : "off")

/**
 * Connects the signed-in profile (`user_profile.profile.auto_translate`), which is shared across the apps. A guest keeps
 * the choice in this browser only.
 */
export function useAccountAutoTranslate(
  profile: { id: string | null; autoTranslate?: boolean | null } | null | undefined,
  save?: (on: boolean) => Promise<unknown>,
) {
  const saved =
    profile?.id && typeof profile.autoTranslate === "boolean" ? (profile.autoTranslate ? "on" : "off") : null
  preference.useAccount(saved, !!profile?.id, save ? (value) => save(value === "on") : undefined)
}
