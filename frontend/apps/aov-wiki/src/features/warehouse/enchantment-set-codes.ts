/**
 * The codes of an enchantment set from what a reader pastes: a link to a set (its `set=` value) or the five codes
 * themselves, separated by commas or spaces. Null when it does not name five enchantments.
 */
export function pastedSetCodes(pasted: string) {
  const text = pasted.trim()
  let value = text
  try {
    const shared = new URL(text).searchParams.get("set")
    if (shared) value = shared
  } catch {
    // Not a link: the text is the codes themselves.
  }
  const codes = value.split(/[\s,]+/).filter(Boolean)
  return codes.length === 5 ? codes : null
}
