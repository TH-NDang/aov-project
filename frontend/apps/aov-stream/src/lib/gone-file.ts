/** How things stand when a file of the app could not be had. */
export type GoneFile = {
  /** A reader waits for what is in it, and has asked for it again. */
  waited: boolean
  again: boolean
  /** A video is open, which ends with the page. */
  watched: boolean
  online: boolean
}

/**
 * Whether loading the page anew may bring a file that could not be had: a page that stays open while two releases come
 * out finds the files of its own gone, and only a new page knows the names of those that are there. It is not done for a
 * file nobody waits for yet or while there is no network, and it ends a video only for a reader who asks again.
 */
export const asksForNewPage = ({ waited, again, watched, online }: GoneFile) => waited && online && (again || !watched)

/**
 * What a tab keeps of the releases it has loaded the page anew for, now with this one; null where this one is among them
 * already, so that a file which stays away does not load the page over and over.
 */
export function noteRelease(kept: string | null, release: string): string | null {
  let before: unknown[] = []
  try {
    const read: unknown = JSON.parse(kept || "[]")
    if (Array.isArray(read)) before = read
  } catch {
    // What another version of the app kept is not worth reading.
  }
  return before.includes(release) ? null : JSON.stringify([...before, release])
}
