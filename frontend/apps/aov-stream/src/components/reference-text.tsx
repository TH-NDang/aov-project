import { Fragment, useMemo } from "react"
import { readRunningText } from "@aov/ui/lib/running-text"
import { plainReferences } from "../lib/reference-model"
import { useReferences } from "../lib/use-references"
import { ReferenceLink } from "./reference-link"

const nothing: readonly string[] = []

/**
 * A text people wrote, with the circuits, competitions, teams, people and game entries it names as links. Introductions,
 * histories, posts and comments all go through it, so a name reads and opens the same everywhere. It renders words and
 * links only: the paragraph around them is the caller's.
 *
 * `about` holds the records the text is about or stands on the page of, as `kind:id` (`referenceKey`): it never links
 * them. `packages/ui/src/lib/reference-names.ts` says when a name counts.
 */
export function ReferenceText({ text, about = nothing }: { text: string; about?: readonly string[] }) {
  // Callers write the list in place, so it is a new one on every render; its content decides.
  const key = about.join(" ")
  const subjects = useMemo(() => (key ? key.split(" ") : nothing), [key])
  const references = useReferences(text, subjects)
  const nodes = useMemo(() => references && readRunningText(text, references, subjects), [text, references, subjects])
  if (!nodes) return <>{plainReferences(text)}</>
  return (
    <>
      {nodes.map((node, position) =>
        node.type === "reference" ? (
          <ReferenceLink key={position} entity={node.entity} label={node.label} />
        ) : (
          <Fragment key={position}>{node.type === "text" ? node.text : null}</Fragment>
        ),
      )}
    </>
  )
}
