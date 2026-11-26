import { useId, type ReactNode, type Ref } from "react"
import "./meetings-section.css"

/** The results of a group: what they are, how to read them, a way to read them otherwise, then the results. */
export function MeetingsSection({
  ref,
  title,
  note,
  part,
  control,
  width,
  children,
}: {
  ref?: Ref<HTMLElement>
  title: string
  note: ReactNode
  /** One of several groups of a stage, under whose name the heading stands back. */
  part: boolean
  control?: ReactNode
  /** The width of a table narrower than the page, in pixels, so that the control stands over its end. */
  width?: number
  children: ReactNode
}) {
  const id = useId()
  const Heading = part ? "h4" : "h3"
  return (
    <section ref={ref} className="tn-meet" data-part={part || undefined} aria-labelledby={id}>
      <div className="tn-meet-head" style={{ maxWidth: width && Math.max(480, width) }}>
        <Heading id={id}>{title}</Heading>
        <p>{note}</p>
        {control}
      </div>
      {children}
    </section>
  )
}
