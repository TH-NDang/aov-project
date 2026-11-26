import { Fragment } from "react"
import { stressed } from "../../../lib/leader-words"

/** A sentence with its names or numbers stressed: those the words put between two asterisks. */
export function FactWords({ words }: { words: string }) {
  return stressed(words).map(({ part, strong }, at) =>
    strong ? <b key={at}>{part}</b> : <Fragment key={at}>{part}</Fragment>,
  )
}
