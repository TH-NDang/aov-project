// Rules that already style a class another stylesheet owns, as "<sheet> .<class>". Each one is fixed when its
// component is reworked: the variation moves to the owning sheet behind a modifier that the owning component sets.
// `pnpm lint` fails on a restyle missing here and on an entry no rule matches any more, so the list only shrinks.
export const knownRestyles = [
  "components/public-preferences-drawer.css .public-account-appearance",
  "components/public-preferences-drawer.css .public-account-language",
  "components/public-preferences-drawer.css .public-account-language-trigger",
  "components/public-preferences-drawer.css .public-account-links",
  "components/public-preferences-drawer.css .public-account-settings",
]
