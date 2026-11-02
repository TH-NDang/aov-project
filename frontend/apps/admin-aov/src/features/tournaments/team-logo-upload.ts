import { createPublishingApi, uploadHeroImage, type Request } from "../publishing/publishing-api"

export class RegistryLogoUploadError extends Error {
  constructor() {
    super("Registry logo has no valid image URL.")
    this.name = "RegistryLogoUploadError"
  }
}

const imageLabels = {
  player: "Ảnh tuyển thủ",
  team: "Logo đội tuyển",
  tournament: "Logo giải đấu",
  organization: "Logo tổ chức",
  cover: "Ảnh bìa",
} as const

/** Reuse Media ingestion; only the resulting immutable URL crosses the service boundary. */
export async function uploadRegistryLogo(
  request: Request,
  file: File,
  owner: {
    kind: "team" | "tournament" | "player" | "organization" | "cover"
    name: string
    sourceUrl?: string
    ownerName?: string
  },
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const scopedRequest: Request = (path, init) => request(path, { ...init, signal })
  const signedUpload: typeof fetch = (input, init) =>
    fetcher(input, {
      ...init,
      signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal,
    })
  const assetId = await uploadHeroImage(
    scopedRequest,
    file,
    "OTHER",
    {
      label: `${imageLabels[owner.kind]} ${owner.name.trim() || file.name}`,
      url: owner.sourceUrl && /^https?:\/\//i.test(owner.sourceUrl) ? owner.sourceUrl : null,
      // Named by the person uploading; never inferred from the team or player name.
      ...(owner.ownerName?.trim() ? { ownerName: owner.ownerName.trim() } : {}),
      note: `Uploaded ${owner.kind} logo: ${file.name}`,
    },
    signedUpload,
  )
  const asset = await createPublishingApi(scopedRequest).asset(assetId)
  if (!asset.currentUrl || !/^https?:\/\//i.test(asset.currentUrl)) throw new RegistryLogoUploadError()
  return asset.currentUrl
}

export function uploadTeamLogo(
  request: Request,
  file: File,
  teamName: string,
  sourceUrl: string | undefined,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  return uploadRegistryLogo(request, file, { kind: "team", name: teamName, sourceUrl }, signal, fetcher)
}
