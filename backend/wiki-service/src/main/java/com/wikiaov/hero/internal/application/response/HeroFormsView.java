package com.wikiaov.hero.internal.application.response;

import com.wikiaov.hero.internal.domain.HeroContent.Role;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * The form switcher for one hero (ADR-024). {@code holder} is the hero that holds the forms: the hero itself when it
 * holds forms, the holding hero when it is a form, and absent for any other hero. {@code formKey} is set only when the
 * requested hero is a form. Names and roles come from each hero's newest draft or published revision, so the switcher
 * matches what editors are working on.
 */
public record HeroFormsView(
        UUID heroId,
        String code,
        Holder holder,
        String formKey,
        List<Form> forms
) {
    public record Holder(
            UUID id,
            String code,
            List<HeroPublishReadinessView.Name> names
    ) {
    }

    public record Form(
            UUID id,
            String code,
            String formKey,
            int displayOrder,
            List<HeroPublishReadinessView.Name> names,
            Set<Role> roles,
            boolean published,
            boolean draftOpen
    ) {
    }
}
