/**
 * A logo with an optional version drawn for dark backgrounds. Both images are in the page and stream.css hides the one
 * that does not suit the theme, so prerendered pages and a theme switch need no script.
 */
export function ThemedLogo({ src, darkSrc }: { src?: string | null; darkSrc?: string | null }) {
  if (src && darkSrc)
    return (
      <>
        <img className="logo-light" src={src} alt="" loading="lazy" />
        <img className="logo-dark" src={darkSrc} alt="" loading="lazy" />
      </>
    )
  const only = src || darkSrc
  return only ? <img src={only} alt="" loading="lazy" /> : null
}
