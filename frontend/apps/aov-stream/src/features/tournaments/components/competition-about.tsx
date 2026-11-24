import { Link } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { ReferenceText } from "../../../components/reference-text"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { referenceKey } from "@aov/ui/lib/running-text-names"
import "./competition-about.css"

/** What the circuit of a competition is, for a reader who meets it here first. Nothing shows without a text. */
export function CompetitionAbout({ view }: { view: CompetitionView }) {
  const { text } = useStreamLocale()
  const { circuit } = view.content
  if (!circuit?.introduction) return null
  return (
    <section className="tn-side-card">
      <h2>{text("Giới thiệu", "About")}</h2>
      <p className="tn-about">
        <ReferenceText
          text={circuit.introduction}
          about={[referenceKey("circuit", circuit.id), referenceKey("competition", view.id)]}
        />
      </p>
      {circuit.published && (
        <Link className="tn-about-more" to={`/pages/${circuit.code}`}>
          {text(`Về ${circuit.shortName || circuit.name}`, `About ${circuit.shortName || circuit.name}`)}
          <StreamIcon name="arrow" size={15} />
        </Link>
      )}
    </section>
  )
}
