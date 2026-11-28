/** Whether Stream posts can be translated now, and into which languages (ADR-037). */
export type TranslationStatus = {
  enabled: boolean
  locales: string[]
}

/** What one image of a post says, in the requested language. */
export type PostImageText = {
  index: number
  hasText: boolean
  /** The language of the words in the image, null without any. */
  language: string | null
  /** Null when the image shows no readable words. */
  text: string | null
}

/** A published post in the reader's language. */
export type PostTranslation = {
  postId: string
  locale: string
  /** The language the post is written in, as far as the service could tell. */
  sourceLanguage: string | null
  /** The post is already in that language: `title` and `body` are its own, and only image texts can be new. */
  sameLanguage: boolean
  title: string | null
  body: string
  images: PostImageText[]
  /** Null when nothing had to be translated. */
  model: string | null
}
