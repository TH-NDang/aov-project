// Rules that already style a class another stylesheet owns, as "<sheet> .<class>". Each one is fixed when its
// feature is reworked: the variation moves to the owning sheet behind a modifier that the owning component sets.
// `pnpm lint` fails on a restyle missing here and on an entry no rule matches any more, so the list only shrinks.
export const knownRestyles = [
  "features/community/components/community-directory.css .cp-follow-chip",
  "features/community/components/community-directory.css .hub-menu-item",
  "features/community/components/community-profile.css .hub-menu-item",
  "features/community/components/community-profile.css .tn-match-grid",
]
