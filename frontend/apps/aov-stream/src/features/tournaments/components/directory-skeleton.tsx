import { useStreamLocale } from "../../../components/stream-locale"
import "./directory-skeleton.css"

/** The shape of the directory while it loads: the scores, the banners and the map, or the rows of a schedule. */
export function DirectorySkeleton({ schedule }: { schedule: boolean }) {
  const { text } = useStreamLocale()
  return (
    <div
      className="tn-directory-skeleton"
      role="status"
      aria-label={
        schedule ? text("Đang tải lịch đấu", "Loading the schedule") : text("Đang tải giải đấu", "Loading tournaments")
      }
    >
      {schedule ? (
        Array.from({ length: 3 }, (_, index) => <span key={index} className="hub-skeleton" data-shape="rows" />)
      ) : (
        <>
          <span className="hub-skeleton" data-shape="scores" />
          <span className="hub-skeleton" data-shape="banners" />
          <span className="hub-skeleton" data-shape="rows" />
        </>
      )}
    </div>
  )
}
