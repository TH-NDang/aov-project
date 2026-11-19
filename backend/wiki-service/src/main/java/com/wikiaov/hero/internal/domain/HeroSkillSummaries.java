package com.wikiaov.hero.internal.domain;

import com.wikiaov.hero.internal.domain.HeroContent.Skill;
import com.wikiaov.hero.internal.domain.HeroContent.SkillTranslation;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Keeps the summaries editors wrote when skills are replaced by text that carries none, such as the game's own. */
public final class HeroSkillSummaries {
    private HeroSkillSummaries() {
    }

    /**
     * Each incoming translation without a summary takes the one its skill already had in the same locale. Incoming
     * skills may not be validated yet, so an incomplete entry is passed on unchanged for validation to refuse.
     */
    public static List<Skill> retain(List<Skill> previous, List<Skill> incoming) {
        Map<String, Skill> existing = new HashMap<>();
        previous.forEach(skill -> existing.put(skill.skillKey(), skill));

        List<Skill> result = new ArrayList<>();
        for (var skill : incoming) {
            var prior = skill == null ? null : existing.get(skill.skillKey());
            result.add(prior == null || skill.translations() == null ? skill : retain(prior, skill));
        }
        return Collections.unmodifiableList(result);
    }

    /** True when the text kept the summary written for a description it no longer has. */
    public static boolean outlivedDescription(SkillTranslation previous, SkillTranslation current) {
        return previous != null && current.summary() != null && current.summary().equals(previous.summary())
                && !Objects.equals(previous.description(), current.description());
    }

    private static Skill retain(Skill prior, Skill skill) {
        Map<String, String> summaries = new HashMap<>();
        prior.translations().stream().filter(text -> text.summary() != null)
                .forEach(text -> summaries.put(text.locale(), text.summary()));
        if (summaries.isEmpty()) {
            return skill;
        }

        List<SkillTranslation> translations = new ArrayList<>();
        for (var text : skill.translations()) {
            translations.add(text == null || text.summary() != null || !summaries.containsKey(text.locale())
                    ? text
                    : new SkillTranslation(text.locale(), text.name(), text.description(),
                            summaries.get(text.locale())));
        }

        return new Skill(skill.skillKey(), skill.kind(), skill.formKey(), skill.displayOrder(), skill.iconAssetId(),
                Collections.unmodifiableList(translations), skill.effects(), skill.stateIcons());
    }
}
