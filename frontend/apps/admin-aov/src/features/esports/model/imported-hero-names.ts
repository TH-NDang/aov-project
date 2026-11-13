/**
 * Hero names that games imported from Liquipedia use where the catalog names the hero otherwise, keyed by `nameKey`,
 * each mapped to a catalog code, with how it was checked on 2026-11-13. Names whose catalog code they already spell
 * (Riktor, Lu Bu, Jinnar, Diao Chan) need no entry. Honor of Kings heroes, and heroes with no catalog hero to show
 * (The Joker and Batman, last played in 2023), are left out on purpose.
 */
export const IMPORTED_HERO_CODES: Readonly<Record<string, string>> = {
  // The hero's Liquipedia page links the Arena of Valor Vietnam page lienquan.garena.vn/hoc-vien/tuong-skin/d/ming/.
  "ming shiyin": "ming",
  // The catalog holds Flowborn's marksman and mage forms; the mage form is `flowborn-mid`.
  "flowborn mage": "flowborn-mid",
  // Reworked and renamed in July 2022: the last Payna pick is 2022-07-07 and the first Helen pick 2022-07-17, and the
  // game's auto chess text for Helen still says "Payna". Liquipedia redirects Peura, another name of hers, to Payna.
  payna: "helen",
  peura: "helen",
  // The Honor of Kings names some regions use: Bolt Baron's skill icons and head were taken from Liquipedia's
  // Sikong Zhen page, and Dolia's head from its Doria icon; both pairs are played in the same seasons.
  "sikong zhen": "bolt-baron",
  doria: "dolia",
}
