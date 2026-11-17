import { normalize, slugify } from "@/lib/text"
/**
 * The page code suggested for a name. Vietnamese and other Latin letters lose their marks; any other script would be
 * silently dropped (a Chinese name would keep only its Latin words), so such names return null and the code must be
 * typed.
 */
export function profileSlug(value: string): string | null {
  if (/[^\p{ASCII}]/u.test(normalize(value))) return null
  return slugify(value)
}
