package com.wikiaov.hero.internal.domain;

import com.wikiaov.hero.internal.domain.HeroContent.*;
import java.util.*;

/**
 * Rules for the evaluation parts of a hero draft (ADR-029): traits travel with the skills and notes with the profile,
 * but each has its own endpoint. Updates of the whole skills or profile section keep what the draft already has.
 */
public final class HeroEvaluations {
    private HeroEvaluations() {
    }

    /**
     * Keeps the draft's traits and notes in a skills or profile update. A trait loses the skills the update removes;
     * notes follow their locale and disappear with it.
     */
    public static Object retain(Object previous, Object incoming) {
        if (previous instanceof Skills old && incoming instanceof Skills next)
            return new Skills(next.skills(), next.sources(), prune(old.traits(), next.skills()));
        if (previous instanceof Profile old && incoming instanceof Profile next) {
            Map<String, ProfileTranslation> notes = new HashMap<>();
            old.translations().forEach(text -> notes.put(text.locale(), text));
            return new Profile(next.translations().stream().map(text -> {
                var prior = notes.get(text.locale());
                return prior == null
                        ? text.withNotes(null, null, null)
                        : text.withNotes(prior.strengths(), prior.weaknesses(), prior.counterTips());
            }).toList(), next.roles(), next.positions(), next.sources());
        }
        return incoming;
    }

    /** One canonical order, so equal traits compare equal however a client sent them. */
    public static List<Trait> normalize(List<Trait> traits) {
        if (traits == null)
            return List.of();
        return traits.stream()
                .map(trait -> new Trait(trait.code(),
                        trait.skillKeys().stream().map(String::strip).distinct().sorted().toList(),
                        trait.translations().stream()
                                .map(text -> new TraitTranslation(text.locale(), text.detail().strip()))
                                .sorted(Comparator.comparing(TraitTranslation::locale)).toList()))
                .sorted(Comparator.comparing(Trait::code))
                .toList();
    }

    /** Notes are optional: blank text means nothing has been written. */
    public static String note(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    private static List<Trait> prune(List<Trait> traits, List<Skill> skills) {
        if (traits == null)
            return List.of();
        Set<String> keys = new HashSet<>();
        skills.forEach(skill -> keys.add(skill.skillKey()));
        return normalize(traits.stream()
                .map(trait -> new Trait(trait.code(), trait.skillKeys().stream().filter(keys::contains).toList(),
                        trait.translations()))
                .toList());
    }
}
