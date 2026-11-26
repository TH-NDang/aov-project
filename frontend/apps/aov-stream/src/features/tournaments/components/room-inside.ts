import { onDemand } from "../../../components/on-demand"

/** What the watch room holds beside its video, with a file of its own, which the video does not wait for. */
export const roomInside = onDemand(() => import("./watch-inside").then((file) => file.WatchInside))
