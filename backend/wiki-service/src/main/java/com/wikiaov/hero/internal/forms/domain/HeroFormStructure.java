package com.wikiaov.hero.internal.forms.domain;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Which heroes hold forms and which heroes play them (ADR-024). A hero that holds forms is what readers browse; each
 * form is a hero aggregate of its own that players pick. Every other hero is both at once.
 */
public final class HeroFormStructure {
    private final Map<UUID, List<Form>> byHolder;
    private final Map<UUID, Form> byForm;

    public HeroFormStructure(Collection<Form> forms) {
        this.byHolder = forms.stream().sorted(Comparator.comparingInt(Form::displayOrder))
                .collect(Collectors.groupingBy(Form::holderId, LinkedHashMap::new, Collectors.toUnmodifiableList()));
        this.byForm = forms.stream().collect(Collectors.toUnmodifiableMap(Form::heroId, form -> form));
    }

    public boolean holdsForms(UUID heroId) {
        return byHolder.containsKey(heroId);
    }

    public boolean isForm(UUID heroId) {
        return byForm.containsKey(heroId);
    }

    /** The forms a hero holds, in switcher order; empty for any other hero. */
    public List<Form> formsOf(UUID holderId) {
        return byHolder.getOrDefault(holderId, List.of());
    }

    public Optional<Form> form(UUID heroId) {
        return Optional.ofNullable(byForm.get(heroId));
    }

    public record Form(
            UUID heroId,
            UUID holderId,
            String formKey,
            int displayOrder
    ) {
    }
}
