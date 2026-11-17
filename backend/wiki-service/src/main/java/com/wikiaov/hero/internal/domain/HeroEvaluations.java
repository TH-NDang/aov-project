package com.wikiaov.hero.internal.domain;

import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroContent.ProfileTranslation;
import com.wikiaov.hero.internal.domain.HeroContent.Skill;
import com.wikiaov.hero.internal.domain.HeroContent.Skills;
import com.wikiaov.hero.internal.domain.HeroContent.Trait;
import com.wikiaov.hero.internal.domain.HeroContent.TraitTranslation;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Rules for the evaluation parts of a hero draft (ADR-029): traits travel with the skills and notes with the profile,
 * but each has its own endpoint. Updates of the whole skills or profile section keep what the draft already has.
 */
public final class HeroEvaluations {
    private HeroEvaluations() {
    }

    /** Keeps the draft's traits in a skills update; a trait loses the skills the update removes. */
    public static Skills retain(Skills previous, Skills incoming) {
        return new Skills(incoming.skills(), incoming.sources(), prune(previous.traits(), incoming.skills()));
    }

    /** Keeps the draft's notes in a profile update; notes follow their locale and disappear with it. */
    public static Profile retain(Profile previous, Profile incoming) {
        Map<String, ProfileTranslation> notes = new HashMap<>();
        previous.translations().forEach(text -> notes.put(text.locale(), text));

        return new Profile(incoming.translations().stream().map(text -> {
            var prior = notes.get(text.locale());
            return prior == null
                    ? text.withNotes(null, null, null)
                    : text.withNotes(prior.strengths(), prior.weaknesses(), prior.counterTips());
        }).toList(), incoming.roles(), incoming.positions(), incoming.sources());
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
