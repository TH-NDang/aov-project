import { createHash } from "node:crypto"

/**
 * Identifies the description a summary was written from. Applying compares it with the description the hero has
 * now, so a summary is never attached to a text that changed after it was written.
 */
export function descriptionFingerprint(description) {
  return createHash("sha256")
    .update((description ?? "").normalize("NFC").trim())
    .digest("hex")
    .slice(0, 16)
}
