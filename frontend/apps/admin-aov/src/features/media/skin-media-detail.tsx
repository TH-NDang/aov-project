import type { MediaRole } from "../publishing/types"
import type { Request } from "../publishing/publishing-api"
import { CharacterMediaViewer } from "./character-image-detail"

export function SkinMediaDetail({
  heroId,
  heroCode,
  heroName,
  revisionId,
  skinKey,
  initialRole = "SPLASH",
  onClose,
  request,
}: {
  heroId: string
  heroCode?: string
  heroName?: string
  revisionId: string
  skinKey: string
  initialRole?: MediaRole
  onClose: () => void
  request?: Request
}) {
  return (
    <CharacterMediaViewer
      key={`${heroId}:${revisionId}:${skinKey}`}
      heroId={heroId}
      heroCode={heroCode}
      heroName={heroName}
      revisionId={revisionId}
      initialRole={initialRole}
      initialOwner={{ ownerType: "SKIN", skinKey }}
      fullPageTab="skins"
      onClose={onClose}
      request={request}
    />
  )
}
