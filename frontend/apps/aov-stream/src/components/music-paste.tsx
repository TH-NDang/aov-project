import { useState, type FormEvent } from "react"
import { useMutation } from "@tanstack/react-query"
import { ApiError } from "../lib/api-client"
import { musicApi } from "../lib/music-api"
import { videoIdOf } from "../lib/music-links"
import { music } from "./music-session"
import { StreamIcon } from "./stream-icon"
import { useStreamLocale } from "./stream-locale"
import "./music-paste.css"

type Problem = "NOT_A_LINK" | "ONLY_ON_YOUTUBE" | "NOT_FOUND" | "UNREACHABLE"

const PROBLEM_WORDS: Record<Problem, [string, string]> = {
  NOT_A_LINK: ["Đây chưa phải link video YouTube.", "That is not a YouTube video link."],
  ONLY_ON_YOUTUBE: ["Video này chỉ phát được trên YouTube.", "This video only plays on YouTube."],
  NOT_FOUND: ["Không tìm thấy video này.", "This video was not found."],
  UNREACHABLE: ["Chưa đọc được video, thử lại sau.", "Could not read the video, try again later."],
}

function problemOf(error: unknown): Problem {
  if (!(error instanceof ApiError)) return "UNREACHABLE"
  if (error.status === 401 || error.status === 403) return "ONLY_ON_YOUTUBE"
  if (error.status === 400 || error.status === 404) return "NOT_FOUND"
  return "UNREACHABLE"
}

/**
 * Adds a video of the reader's choosing to their own list, kept in this browser only. YouTube says first whether the
 * video may be played on another site, and what it is called.
 */
export function MusicPaste() {
  const { text } = useStreamLocale()
  const [link, setLink] = useState("")
  const [problem, setProblem] = useState<Problem | null>(null)
  const add = useMutation({
    mutationFn: async (video: string) => ({ video, facts: await musicApi.facts(video) }),
    onSuccess: ({ video, facts }) => {
      music.add({ video, title: facts.title, artist: facts.author_name })
      setLink("")
    },
    onError: (error) => setProblem(problemOf(error)),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const video = videoIdOf(link)
    setProblem(video ? null : "NOT_A_LINK")
    if (video) add.mutate(video)
  }

  const words = problem && PROBLEM_WORDS[problem]
  return (
    <form className="hub-music-paste" onSubmit={submit}>
      <div className="hub-music-paste-field">
        <StreamIcon name="link" size={16} />
        <input
          type="url"
          inputMode="url"
          value={link}
          placeholder={text("Dán link YouTube", "Paste a YouTube link")}
          aria-label={text("Link video YouTube", "YouTube video link")}
          aria-invalid={problem ? true : undefined}
          onChange={(event) => {
            setLink(event.currentTarget.value)
            setProblem(null)
          }}
        />
        <button type="submit" disabled={!link.trim() || add.isPending}>
          {add.isPending ? text("Đang đọc…", "Reading…") : text("Thêm", "Add")}
        </button>
      </div>
      {words && (
        <p className="cp-field-error" role="alert">
          {text(words[0], words[1])}
        </p>
      )}
    </form>
  )
}
