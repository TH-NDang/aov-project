import { useWatch } from "../../../components/use-watch"
import { VideoPlace } from "../../../components/video-place"
import type { WatchMatch } from "../../../lib/watch-types"
import { WatchFailure } from "./watch-failure"
import "./watch-screen.css"

/** The place of the video, which the frame of the app is laid over; where it fails, what to do instead. */
export function WatchScreen({ match }: { match: WatchMatch }) {
  const failure = useWatch((view) => view.failure)
  return (
    <div className="tn-room-screen">
      <VideoPlace seriesId={match.seriesId} />
      {failure && <WatchFailure match={match} failure={failure} />}
    </div>
  )
}
