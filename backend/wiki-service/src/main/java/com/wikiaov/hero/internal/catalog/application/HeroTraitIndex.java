package com.wikiaov.hero.internal.catalog.application;

import com.wikiaov.hero.internal.application.response.HeroTraitsView;
import com.wikiaov.hero.internal.domain.HeroContent.TraitCode;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.forms.application.HeroForms;
import com.wikiaov.hero.internal.skills.persistence.HeroSkillSnapshots;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Which heroes readers see with each trait in a market today (ADR-029), for the "same trait" lists of the Wiki. Heroes
 * and forms are listed, not the heroes that hold forms, from the same published revisions the hero list shows.
 */
@Service
@Transactional(readOnly = true)
public class HeroTraitIndex {
    private final HeroQueries queries;
    private final HeroSkillSnapshots skills;
    private final HeroForms forms;

    public HeroTraitIndex(HeroQueries queries, HeroSkillSnapshots skills, HeroForms forms) {
        this.queries = queries;
        this.skills = skills;
        this.forms = forms;
    }

    public HeroTraitsView read(String region) {
        var structure = forms.structure();
        var published = queries.published(region);

        Map<UUID, String> codes = new LinkedHashMap<>();
        Map<UUID, UUID> skillSets = new LinkedHashMap<>();
        published.forEach((hero, revision) -> {
            if (structure.holdsForms(hero.getId()))
                return;
            codes.put(hero.getId(), hero.getCode());
            skillSets.put(hero.getId(), revision.sections().get(HeroSection.SKILLS));
        });
        var traits = skills.traits(new HashSet<>(skillSets.values()));

        Map<TraitCode, List<HeroTraitsView.Hero>> byCode = new EnumMap<>(TraitCode.class);
        skillSets.forEach((heroId, skillSetId) -> traits.getOrDefault(skillSetId, List.of())
                .forEach(trait -> byCode.computeIfAbsent(trait.code(), code -> new ArrayList<>())
                        .add(new HeroTraitsView.Hero(heroId, codes.get(heroId)))));

        return new HeroTraitsView(region, Arrays.stream(TraitCode.values())
                .map(code -> new HeroTraitsView.Trait(code.name(), byCode.getOrDefault(code, List.of()))).toList());
    }
}
