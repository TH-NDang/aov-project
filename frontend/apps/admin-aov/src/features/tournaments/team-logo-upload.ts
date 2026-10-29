import { createPublishingApi, uploadHeroImage, type Request } from "../publishing/publishing-api"

export class RegistryLogoUploadError extends Error {
  constructor() {
    super("Registry logo has no valid image URL.")
    this.name = "RegistryLogoUploadError"
  }
}

/** Reuse Media ingestion; only the resulting immutable URL crosses the service boundary. */
export async function uploadRegistryLogo(
  request: Request,
  file: File,
  owner: { kind: "team" | "tournament" | "player"; name: string; sourceUrl?: string },
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
      label: `${owner.kind === "player" ? "Ảnh tuyển thủ" : owner.kind === "team" ? "Logo đội tuyển" : "Logo giải đấu"} ${owner.name.trim() || file.name}`,
      url: owner.sourceUrl && /^https?:\/\//i.test(owner.sourceUrl) ? owner.sourceUrl : null,
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
