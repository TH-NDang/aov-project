/**
 * Folds text for search: lower case, no tone marks and the Vietnamese d with stroke read as a plain d, so a query typed
 * without accents still finds an accented name. Search boxes of every app compare folded text on both sides.
 */
export function foldSearchText(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase()
}
