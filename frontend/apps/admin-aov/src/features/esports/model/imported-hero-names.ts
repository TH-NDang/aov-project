/**
 * Hero names that games imported from Liquipedia use where the catalog names the hero otherwise, keyed by `nameKey`,
 * each mapped to a catalog code. Every entry was checked on 2026-11-13 against the Arena of Valor Vietnam page that
 * the hero's Liquipedia page links as `page_aov` (lienquan.garena.vn/hoc-vien/tuong-skin/d/<slug>/). Names whose
 * catalog code they already spell (Riktor, Lu Bu, Jinnar, Diao Chan) need no entry. Honor of Kings heroes without an
 * Arena of Valor Vietnam page, and heroes the catalog does not hold yet, are left out on purpose: they have no catalog
 * hero to show.
 */
export const IMPORTED_HERO_CODES: Readonly<Record<string, string>> = {
  "ming shiyin": "ming",
  "flowborn mage": "flowborn-mid",
}
