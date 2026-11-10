package com.wikiaov.hero.internal.skills.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.skills.persistence.HeroSkillImageRepository;
import com.wikiaov.hero.internal.skills.persistence.entity.HeroSkillImage;
import java.util.*;
import org.junit.jupiter.api.Test;

class SkillLibraryIconsTest {
    private final UUID heroId = UUID.randomUUID();

    @Test
    void anImageLinkedToTheSkillWinsOverOneOfTheSameSlot() {
        var linked = image("skill-1-2", 1, 1);
        var bySlot = image(null, 1, 2);

        assertThat(SkillLibraryIcons.match(skill("skill-1-2", null), List.of(bySlot, linked)))
                .contains(linked.getAssetId());
    }

    @Test
    void aSkillWithoutALinkedImageTakesTheOnlyUnlinkedImageOfItsSlotAndVariant() {
        var first = image(null, 2, 1);
        var second = image(null, 2, 2);
        var linkedElsewhere = image("skill-0-1", 2, 2);

        assertThat(SkillLibraryIcons.match(skill("skill-2-2", null), List.of(first, second, linkedElsewhere)))
                .contains(second.getAssetId());
    }

    @Test
    void anAmbiguousOrMisplacedMatchGivesNoPicture() {
        var twice = List.of(image("skill-3-1", 3, 1), image("skill-3-1", 3, 2));
        var movedSlot = new Skill("skill-1-1", SkillKind.ACTIVE, null, 1, null, List.of(),
                List.of(new Effect("SOURCE_SNAPSHOT", Map.of("sourceSlot", 2))), List.of());

        assertThat(SkillLibraryIcons.match(skill("skill-3-1", null), twice)).isEmpty();
        assertThat(SkillLibraryIcons.match(movedSlot, List.of(image(null, 1, 1), image(null, 2, 1)))).isEmpty();
        assertThat(SkillLibraryIcons.match(skill("capture-skill-1", null), List.of(image(null, 1, 1)))).isEmpty();
    }

    @Test
    void onlySkillsWithoutTheirOwnIconAreLookedUp() {
        var images = mock(HeroSkillImageRepository.class);
        var library = image(null, 1, 1);
        when(images.findByHeroIdOrderBySourceSlotAscVariantNoAsc(heroId))
                .thenReturn(List.of(library, image(null, 2, 1)));
        var icons = new SkillLibraryIcons(images);

        assertThat(icons.forSkills(heroId, List.of(skill("skill-1-1", null), skill("skill-2-1", UUID.randomUUID()))))
                .containsExactly(Map.entry("skill-1-1", library.getAssetId()));
        assertThat(icons.forSkills(heroId, List.of(skill("skill-2-1", UUID.randomUUID())))).isEmpty();
        verify(images, times(1)).findByHeroIdOrderBySourceSlotAscVariantNoAsc(heroId);
    }

    private static Skill skill(String key, UUID iconAssetId) {
        return new Skill(key, SkillKind.ACTIVE, null, 1, iconAssetId, List.of(), List.of(), List.of());
    }

    private HeroSkillImage image(String skillKey, int slot, int variant) {
        var image = new HeroSkillImage();
        image.setId(UUID.randomUUID());
        image.setHeroId(heroId);
        image.setSkillKey(skillKey);
        image.setSourceSlot(slot);
        image.setVariantNo(variant);
        image.setAssetId(UUID.randomUUID());
        return image;
    }
}
