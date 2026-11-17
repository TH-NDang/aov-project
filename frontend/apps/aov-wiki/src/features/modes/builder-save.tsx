import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router"
import { useWikiContext, useWikiText } from "../../context/wiki-context"
import { signIn, useWikiSession } from "../../lib/wiki-auth"
import { encodeLineup, type BuilderUnit } from "./auto-chess-model"
import type { GuideIndex } from "./guide-ui"
import { deleteLineup, lineupErrorMessage, modeKeys, myStateQuery, saveLineup } from "./mode-api"

/** Name and note for the lineup, then the reader's own lineups; a signed-out reader is asked to sign in first. */
export function SaveLineup({
  code,
  units,
  emblems,
  index,
}: {
  code: string
  units: BuilderUnit[]
  emblems: string[]
  index: GuideIndex
}) {
  const { href, locale } = useWikiContext()
  const text = useWikiText()
  const session = useWikiSession()
  const client = useQueryClient()
  const me = useQuery({ ...myStateQuery(code, session.revision), enabled: session.status === "authenticated" })
  const [name, setName] = useState("")
  const [note, setNote] = useState("")
  const [message, setMessage] = useState("")
  const refresh = () => client.invalidateQueries({ queryKey: modeKeys.mode(code) })
  const save = useMutation({
    mutationFn: () =>
      saveLineup(code, {
        name: name.trim(),
        note: note.trim() || undefined,
        units: units.map((unit) => ({ ...unit, itemCodes: [] })),
        emblems,
      }),
    onSuccess: () => {
      setMessage(text("Đã lưu và chia sẻ đội hình.", "Lineup saved and shared."))
      setName("")
      setNote("")
      void refresh()
    },
    onError: (error) => setMessage(lineupErrorMessage(error, locale)),
  })
  const remove = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => deleteLineup(code, id, version),
    onSuccess: () => void refresh(),
    onError: (error) => setMessage(lineupErrorMessage(error, locale)),
  })
  const members = units.map((unit) => index.units.get(unit.unitCode)?.name).filter(Boolean)

  if (session.status !== "authenticated")
    return (
      <div className="wiki-guide-lineup-post">
        <p className="wiki-mode-prose">
          {text(
            "Đăng nhập để lưu đội hình, chia sẻ với cộng đồng và nhận lượt thích.",
            "Sign in to save lineups, share them with the community and get likes.",
          )}
        </p>
        <button type="button" className="wiki-guide-primary" onClick={() => void signIn()}>
          {text("Đăng nhập", "Sign in")}
        </button>
      </div>
    )

  return (
    <div className="wiki-guide-lineup-post">
      <p className="wiki-mode-meta">
        {members.length
          ? text(
              `${members.length} quân: ${members.join(", ")}`,
              `${members.length} ${members.length === 1 ? "unit" : "units"}: ${members.join(", ")}`,
            )
          : "Đội hình chưa có quân cờ nào."}
      </p>
      <form
        className="wiki-guide-builder-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim() && units.length) save.mutate()
        }}
      >
        <label>
          <span>{text("Tên đội hình", "Lineup name")}</span>
          <input
            className="wiki-guide-field"
            value={name}
            maxLength={60}
            placeholder={text("Ví dụ: Pháp sư lãng khách", "For example: Wandering mages")}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          <span>{text("Ghi chú lối chơi (tùy chọn)", "Gameplay notes (optional)")}</span>
          <textarea
            className="wiki-guide-field"
            value={note}
            maxLength={280}
            rows={3}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <button type="submit" className="wiki-guide-primary" disabled={!name.trim() || !units.length || save.isPending}>
          {save.isPending ? text("Đang lưu…", "Saving…") : text("Lưu và chia sẻ", "Save and share")}
        </button>
        {message && (
          <p className="wiki-mode-message" role="status">
            {message}
          </p>
        )}
      </form>
      {me.data && me.data.lineups.length > 0 && (
        <section className="wiki-guide-detail-block" aria-labelledby="wiki-guide-my-lineups">
          <h3 id="wiki-guide-my-lineups">{text("Đội hình của tôi", "My lineups")}</h3>
          <ul className="wiki-guide-my-lineups">
            {me.data.lineups.map((lineup) => (
              <li key={lineup.id}>
                <Link
                  to={href(`/modes/${encodeURIComponent(code)}/builder?${encodeLineup(lineup.units, lineup.emblems)}`)}
                >
                  {lineup.name}
                </Link>
                <span className="wiki-mode-meta">
                  ♥ {lineup.likes}
                  {lineup.status === "HIDDEN" && text(" · đã bị ẩn", " · hidden")}
                </span>
                <button
                  type="button"
                  className="wiki-mode-chip"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ id: lineup.id, version: lineup.version })}
                >
                  {text("Xóa", "Delete")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
