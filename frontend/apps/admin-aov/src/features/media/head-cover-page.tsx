import { CharacterImagesPage } from "./character-images-page"
export function HeadCoverPage({ kind = "head" }: { kind?: "head" | "cover" }) {
  return <CharacterImagesPage role={kind === "cover" ? "SPLASH" : "HEAD"} />
}
export function HeadPage() {
  return <CharacterImagesPage role="HEAD" />
}
export function CoverPage() {
  return <CharacterImagesPage role="SPLASH" />
}
