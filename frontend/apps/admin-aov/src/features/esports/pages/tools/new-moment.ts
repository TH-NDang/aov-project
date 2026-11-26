import type { GameDesk } from "../game-desk"
import { momentRefusal } from "./moment-actions"

/**
 * Why the form of a new moment stays shut. A game with a video takes its moments once it has begun, as the pad and the
 * track do, so the form would only offer 0:00; a game without a video is recorded by hand, at a typed time.
 */
export const newMomentRefusal = (desk: GameDesk): string | null =>
  desk.videoId && !desk.chapter.live ? momentRefusal(desk) : null
