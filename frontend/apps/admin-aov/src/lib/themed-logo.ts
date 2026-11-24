import { useResolvedTheme } from "@/app/theme"
import { chooseLogo } from "./logo-choice"

/** `chooseLogo` for the Admin theme, or for a surface that is dark in both themes, such as the match banner. */
export function useThemedLogo(
  light: string | null | undefined,
  dark: string | null | undefined,
  surface: "theme" | "dark" = "theme",
) {
  const resolvedTheme = useResolvedTheme()
  return chooseLogo(light, dark, surface === "dark" || resolvedTheme === "dark")
}
