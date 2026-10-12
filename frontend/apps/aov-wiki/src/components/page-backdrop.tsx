/**
 * Full-width background image behind the top of the page, like the HoYoWiki home page:
 * fixed to the viewport, 540px tall, 45% opacity, fading into the page background.
 * Phones (≤640px) follow the HoYoWiki mobile page: scrolls with the page, two thirds of the
 * screen width tall, 20% opacity, with the fade covering the whole image.
 * Without an image it shows a soft amber glow as a placeholder.
 */
export function PageBackdrop({ image }: { image?: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[540px] bg-cover bg-top bg-no-repeat opacity-45 after:absolute after:inset-x-0 after:bottom-0 after:h-[364px] after:bg-linear-to-b after:from-transparent after:to-background after:content-[''] max-[640px]:absolute max-[640px]:h-[66.667vw] max-[640px]:opacity-20 max-[640px]:after:h-full"
      style={{
        backgroundImage: image
          ? `url("${image}")`
          : "radial-gradient(ellipse 70% 90% at 50% 0%, var(--amber-accent), transparent 70%)",
      }}
    />
  )
}
