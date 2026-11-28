import { useEffect, useState } from "react"
import type { CommunityPost, PostTranslation } from "@aov/community-contracts"
import { useAutoTranslate } from "@aov/ui/lib/auto-translate"
import { ReferenceText } from "../../../components/reference-text"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { usePostTranslation, useTranslationStatus } from "../../../lib/translation-queries"
import {
  foldsImageNotes,
  imageNotes,
  languageName,
  replacesWords,
  translatesOnItsOwn,
  translationOffer,
  type TranslationOffer,
} from "../model/post-translation"
import "./post-translation.css"

export type PostTranslationState = {
  offer: TranslationOffer
  /** The translation to show now; null while the reader sees the post as written. */
  shown: PostTranslation | null
  loading: boolean
  error: Error | null
  /** The reader asked for this translation, rather than auto-translate. */
  asked: boolean
  translate: () => void
  showOriginal: () => void
  /** Set on the post's element, so auto-translate starts when the post comes near the screen. */
  watch: (element: HTMLElement | null) => void
}

/**
 * A post's translation into the reader's language (ADR-037): asked for with a button, or on its own when the reader
 * turned on auto-translate and the post comes near the screen. "See original" brings the post back as written.
 */
export function usePostTranslationState(post: CommunityPost): PostTranslationState {
  const { languageTag } = useStreamLocale()
  const status = useTranslationStatus()
  const auto = useAutoTranslate()
  const available = !!status.data?.enabled && status.data.locales.includes(languageTag)
  const offer = available ? translationOffer(post, languageTag) : null
  const [asked, setAsked] = useState(false)
  const [original, setOriginal] = useState(false)
  const [element, watch] = useState<HTMLElement | null>(null)
  const [near, setNear] = useState(false)
  const automatic = auto && translatesOnItsOwn(offer) && !original
  useEffect(() => {
    if (!automatic || near || !element || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true)
      },
      { rootMargin: "240px 0px" },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [automatic, near, element])
  const wanted = !!offer && (asked || (automatic && near))
  const translation = usePostTranslation(post, languageTag, wanted)
  return {
    offer,
    shown: translation.data && !original ? translation.data : null,
    loading: translation.isFetching,
    error: translation.error,
    asked,
    translate: () => {
      setOriginal(false)
      setAsked(true)
      if (translation.isError) void translation.refetch()
    },
    showOriginal: () => setOriginal(true),
    watch,
  }
}

/**
 * The line under a post that offers, waits for or names its translation. A picture post in the reader's own words
 * offers it from the post menu instead, so most posts keep a quiet foot.
 */
export function PostTranslationBar({ state, post }: { state: PostTranslationState; post: CommunityPost }) {
  const { locale, languageTag, text } = useStreamLocale()
  const { offer, shown, loading, error, asked } = state
  if (!offer) return null
  if (loading)
    return (
      <p className="ps-translate" role="status">
        <StreamIcon name="globe" size={14} />
        {text("Đang dịch…", "Translating…")}
      </p>
    )
  if (error)
    return (
      <p className="ps-translate" data-error="true">
        <StreamIcon name="globe" size={14} />
        <span role="alert">{error.message}</span>
        <button className="cp-text-button" onClick={state.translate}>
          {text("Thử lại", "Try again")}
        </button>
      </p>
    )
  if (shown) {
    const from = languageName(shown.sourceLanguage, locale === "en")
    const notes = imageNotes(shown, languageTag).length
    const replaced = replacesWords(shown, post)
    if (!replaced && !notes)
      return asked ? (
        <p className="ps-translate">
          <StreamIcon name="globe" size={14} />
          {text("Không có chữ nào cần dịch.", "Nothing here needs translating.")}
        </p>
      ) : null
    return (
      <p className="ps-translate" data-translated="true">
        <StreamIcon name="globe" size={14} />
        <span>
          {replaced
            ? from
              ? text(`Đã dịch từ ${from}`, `Translated from ${from}`)
              : text("Đã dịch", "Translated")
            : text("Đã dịch chữ trong ảnh", "Image text translated")}
        </span>
        <button className="cp-text-button" onClick={state.showOriginal}>
          {replaced ? text("Xem bản gốc", "See original") : text("Ẩn", "Hide")}
        </button>
      </p>
    )
  }
  if (offer === "images") return null
  return (
    <p className="ps-translate">
      <button className="cp-text-button ps-translate-ask" onClick={state.translate}>
        <StreamIcon name="globe" size={14} />
        {text("Xem bản dịch", "See translation")}
      </button>
    </p>
  )
}

/**
 * What the pictures of a post say in the reader's language, one entry per picture that has other words, with the
 * lines the picture has. A long one (a schedule, a list of prizes) shows its first lines until the reader asks for all.
 */
export function PostImageNotes({ translation, count }: { translation: PostTranslation; count: number }) {
  const { languageTag, text } = useStreamLocale()
  const [open, setOpen] = useState(false)
  const notes = imageNotes(translation, languageTag)
  if (!notes.length) return null
  const folds = foldsImageNotes(notes)
  return (
    <div className="ps-image-notes" data-folded={(folds && !open) || undefined}>
      <ul lang={languageTag} aria-label={text("Chữ trong ảnh", "Text in the images")}>
        {notes.map((note) => (
          <li key={note.index}>
            <span className="ps-image-note-mark">
              {count > 1 ? text(`Ảnh ${note.index + 1}`, `Image ${note.index + 1}`) : text("Trong ảnh", "In the image")}
            </span>
            <span className="ps-image-note-text">
              <ReferenceText text={note.text} />
            </span>
          </li>
        ))}
      </ul>
      {folds && (
        <button
          type="button"
          className="cp-text-button ps-image-notes-fold"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? text("Thu gọn", "Show less") : text("Xem hết chữ trong ảnh", "Show all image text")}
        </button>
      )}
    </div>
  )
}
