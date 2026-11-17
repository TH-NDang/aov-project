package com.wikiaov.hero.internal.skills.application;

import com.wikiaov.hero.internal.domain.HeroContent.Skill;
import com.wikiaov.hero.internal.skills.persistence.HeroSkillImageRepository;
import com.wikiaov.hero.internal.skills.persistence.entity.HeroSkillImage;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Finds the picture of a skill that has none of its own in the hero's skill image library, by the rule the Admin skills
 * view uses: the one image linked to the skill, otherwise the one image of its slot and variant that is linked to no
 * skill. An ambiguous match gives no picture, so a reader never sees another skill's icon.
 */
@Component
public class SkillLibraryIcons {
    private static final Pattern VARIANT_KEY = Pattern.compile("skill-(\\d+)-(\\d+)");

    private final HeroSkillImageRepository images;

    public SkillLibraryIcons(HeroSkillImageRepository images) {
        this.images = images;
    }

    /** Library assets by skill key, for the skills that have no icon of their own. */
    public Map<String, UUID> forSkills(UUID heroId, List<Skill> skills) {
        if (skills.stream().allMatch(skill -> skill.iconAssetId() != null))
            return Map.of();

        var library = images.findByHeroIdOrderBySourceSlotAscVariantNoAsc(heroId);
        Map<String, UUID> result = new HashMap<>();
        for (var skill : skills)
            if (skill.iconAssetId() == null)
                match(skill, library).ifPresent(assetId -> result.put(skill.skillKey(), assetId));
        return result;
    }

    static Optional<UUID> match(Skill skill, List<HeroSkillImage> library) {
        var linked = library.stream().filter(image -> skill.skillKey().equals(image.getSkillKey())).toList();
        if (!linked.isEmpty())
            return linked.size() == 1 ? Optional.of(linked.getFirst().getAssetId()) : Optional.empty();

        var key = VARIANT_KEY.matcher(skill.skillKey());
        if (!key.matches())
            return Optional.empty();
        int slot = sourceSlot(skill).orElse(Integer.parseInt(key.group(1)));
        if (slot != Integer.parseInt(key.group(1)))
            return Optional.empty();

        int variant = Integer.parseInt(key.group(2));
        var unlinked = library.stream().filter(image -> image.getSkillKey() == null && image.getSourceSlot() == slot
                && image.getVariantNo() == variant).toList();
        return unlinked.size() == 1 ? Optional.of(unlinked.getFirst().getAssetId()) : Optional.empty();
    }

    /** The slot the imported source gave the skill, which wins over the slot in its key. */
    private static Optional<Integer> sourceSlot(Skill skill) {
        var snapshot = skill.effects().stream().filter(effect -> "SOURCE_SNAPSHOT".equals(effect.effectType()))
                .findFirst();
        if (snapshot.isEmpty() || !(snapshot.get().metadata().get("sourceSlot") instanceof Number number))
            return Optional.empty();

        double slot = number.doubleValue();
        return slot >= 0 && slot == Math.rint(slot) ? Optional.of((int) slot) : Optional.empty();
    }
}
