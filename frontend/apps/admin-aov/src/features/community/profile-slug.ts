/**
 * The page code suggested for a name. Vietnamese and other Latin letters lose their marks; any other script would be
 * silently dropped (a Chinese name would keep only its Latin words), so such names return null and the code must be
 * typed.
 */
export function profileSlug(value: string): string | null {
  const latin = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
  if (/[^\p{ASCII}]/u.test(latin)) return null
  return latin
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
