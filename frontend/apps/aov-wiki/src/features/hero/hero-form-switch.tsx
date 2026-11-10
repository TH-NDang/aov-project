import { Link, useSearchParams } from "react-router"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import type { HeroListForm, HeroListItem } from "./hero-api"
import { HERO_ROLES, localizedHeroOptions } from "./hero-classifications"
import { formLabelRole, heroFormPath } from "./hero-forms"
import { HeroGlyph } from "./hero-glyph"
import "./hero-form-switch.css"

/**
 * The form switcher beside the hero's name (ADR-024), like the class icons in the game. Each form is a link to its
 * own address, so it can be shared and opens on its own static page; the chosen ability stays open when the other
 * form has the same one.
 */
export function HeroFormSwitch({ hero, current }: { hero: HeroListItem; current?: HeroListForm }) {
  const scope = useWikiContext()
  const [params] = useSearchParams()
  const forms = hero.forms ?? []
  // A single published form is still named, so readers know which form the page describes.
  if (!forms.length) return null

  const roles = localizedHeroOptions(HERO_ROLES, scope.locale)
  const skill = params.get("skill")
  return (
    <nav className="wiki-hero-forms" aria-label={wikiText(scope.locale, "Dạng tướng", "Hero forms")}>
      {forms.map((form) => {
        const role = roles.find((option) => option.value === formLabelRole(form, forms))
        const firstRole = roles.find((option) => option.value === form.roles[0])
        const path = heroFormPath(hero.code, form.formKey, forms)
        return (
          <Link
            key={form.id}
            className="wiki-hero-form"
            to={scope.href(skill ? `${path}?skill=${encodeURIComponent(skill)}` : path)}
            aria-current={form.id === current?.id ? "page" : undefined}
            preventScrollReset
            title={form.name}
          >
            {firstRole && <HeroGlyph name={firstRole.glyph} />}
            <span>{role?.label ?? form.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
