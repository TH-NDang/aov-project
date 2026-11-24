/** The background a logo was drawn for, painted behind it when the surface around it is the other one. */
export type LogoPlate = "light" | "dark"
export type LogoChoice = { url?: string; plate?: LogoPlate }

/**
 * Which logo a surface shows. A dark surface takes the version drawn for dark backgrounds and a light one the usual
 * logo; when only the other version exists it is shown on a plate of the colour it was drawn for, so dark ink never
 * sinks into a dark surface or white ink into a light one.
 */
export function chooseLogo(light: string | null | undefined, dark: string | null | undefined, darkSurface: boolean) {
  const choice: LogoChoice = darkSurface
    ? dark
      ? { url: dark }
      : light
        ? { url: light, plate: "light" }
        : {}
    : light
      ? { url: light }
      : dark
        ? { url: dark, plate: "dark" }
        : {}
  return choice
}
