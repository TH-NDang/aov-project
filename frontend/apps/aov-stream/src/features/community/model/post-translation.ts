import type { PostTranslation } from "@aov/community-contracts"

const REF = /<ref=[^>]{1,200}>[\s\S]*?<\/ref>/g
const NOISE = /https?:\/\/\S+|[#@][\p{L}\p{N}_]+/gu
const WORD = /\p{L}+/gu
const LATIN = /^\p{Script=Latin}+$/u
const THAI = /[฀-๿]/
const HAN = /\p{Script=Han}/u
/** Letters only Vietnamese uses among the Latin languages players write in. */
const VIETNAMESE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/iu

/**
 * The language a post is written in, from its letters, the same way community-service guesses it (ADR-037): Thai or
 * Chinese when a fifth of the letters are, otherwise Vietnamese when 15% of the Latin words carry its letters, else
 * English. Null when there are too few words to tell. Names in reference tags, links and hashtags do not count.
 */
export function guessLanguage(text: string): string | null {
  const plain = text.normalize("NFC").replace(REF, " ").replace(NOISE, " ")
  let letters = 0
  let thai = 0
  let han = 0
  for (const char of plain) {
    if (!/\p{L}/u.test(char)) continue
    letters++
    if (THAI.test(char)) thai++
    else if (HAN.test(char)) han++
  }
  if (!letters) return null
  if (thai * 5 >= letters) return "th-TH"
  if (han * 5 >= letters) return "zh-TW"
  const words = (plain.match(WORD) ?? []).filter((word) => LATIN.test(word))
  if (words.length < 3) return null
  const vietnamese = words.filter((word) => VIETNAMESE.test(word)).length
  return vietnamese * 100 >= words.length * 15 ? "vi-VN" : "en-US"
}

/**
 * What a reader can have translated. `text`: the words are in another language. `unknown`: too few words to tell, with
 * pictures that may say something. `images`: the words are the reader's, but the pictures may not be. Null: nothing to
 * translate.
 */
export type TranslationOffer = "text" | "unknown" | "images" | null

export function translationOffer(
  post: { status: string; title?: string | null; body: string; imageUrls?: string[] },
  target: string,
): TranslationOffer {
  if (post.status !== "PUBLISHED") return null
  const language = guessLanguage(`${post.title ?? ""}\n${post.body}`)
  const pictures = (post.imageUrls ?? []).length > 0
  if (language && language !== target) return "text"
  if (pictures) return language ? "images" : "unknown"
  return null
}

/**
 * Auto-translate asks only for posts likely to read differently: a picture post in the reader's own words is translated
 * when they ask, so the hourly limit goes to posts in other languages.
 */
export const translatesOnItsOwn = (offer: TranslationOffer) => offer === "text" || offer === "unknown"

/** The words of the images that are not in the reader's language, in the post's order. */
export function imageNotes(translation: PostTranslation, target: string) {
  return translation.images.flatMap((image) =>
    image.hasText && image.text?.trim() && image.language !== target
      ? [{ index: image.index, text: image.text.trim(), language: image.language }]
      : [],
  )
}

/** Lines of picture words shown before "Show all": a schedule or a list of prizes runs longer and folds. */
const IMAGE_NOTE_LINES = 3

/** Whether the words of the pictures fold: more lines than that, counting a long line as several. */
export const foldsImageNotes = (notes: { text: string }[]) =>
  notes.reduce(
    (lines, note) =>
      lines + note.text.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 60)), 0),
    0,
  ) > IMAGE_NOTE_LINES

/** Whether the translation changes the words shown, rather than only adding what the images say. */
export const replacesWords = (translation: PostTranslation, post: { title?: string | null; body: string }) =>
  !translation.sameLanguage &&
  translation.body.trim().length > 0 &&
  (translation.body.trim() !== post.body.trim() || (translation.title ?? "").trim() !== (post.title ?? "").trim())

const NAMES: Record<string, [string, string]> = {
  "vi-VN": ["tiếng Việt", "Vietnamese"],
  "en-US": ["tiếng Anh", "English"],
  "th-TH": ["tiếng Thái", "Thai"],
  "zh-TW": ["tiếng Trung", "Chinese"],
  "id-ID": ["tiếng Indonesia", "Indonesian"],
}

/** A language as a sentence names it, in the reader's language ("Thai" in English). Null for a language the service could not name. */
export function languageName(tag: string | null | undefined, english: boolean) {
  const name = tag ? NAMES[tag] : undefined
  return name ? name[english ? 1 : 0] : null
}
