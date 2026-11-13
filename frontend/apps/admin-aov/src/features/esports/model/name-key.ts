/** Apostrophe-like marks written in place of a plain apostrophe: curly quotes, the modifier letter, grave, acute. */
const APOSTROPHES = /[‘’‛ʼ`´]/g

/**
 * A name reduced to what identifies it, for matching a recorded name against the catalog: accents, case, spacing and
 * the kind of apostrophe do not matter. Imported games write "Y'bneth", "Tel'Annas" and "Azzen'Ka" with a plain
 * apostrophe where the catalog uses a curly one; both must find the same hero.
 */
export const nameKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .replace(APOSTROPHES, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase()
