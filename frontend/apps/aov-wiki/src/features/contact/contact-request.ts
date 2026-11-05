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
  const response = await fetch("/api/wiki/v1/media/contact-requests", {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new ContactRequestError(response.status)
  const result = await response.json()
  if (typeof result?.id !== "string" || !result.id.trim()) throw new ContactRequestError(502)
  return result.id as string
}
