import { isWikiApiError, wikiRequest } from "./wiki-api.ts"
interface ContactRequest {
  name: string
  email: string
  topic: string
  message: string
  assetId?: string | null
  versionId?: string | null
}

export class ContactRequestError extends Error {
  readonly status: number
  constructor(status: number) {
    super("Contact request failed.")
    this.status = status
  }
}

export async function sendContactRequest(input: ContactRequest) {
  let result: { id?: unknown } | undefined
  try {
    result = await wikiRequest<{ id?: unknown }>("/media/contact-requests", { method: "POST", body: input })
  } catch (error) {
    throw new ContactRequestError(isWikiApiError(error) ? error.status : 0)
  }
  if (typeof result?.id !== "string" || !result.id.trim()) throw new ContactRequestError(502)
  return result.id
}
