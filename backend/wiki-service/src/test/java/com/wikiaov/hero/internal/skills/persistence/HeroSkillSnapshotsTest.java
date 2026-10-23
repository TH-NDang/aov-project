package com.wikiaov.hero.internal.skills.persistence;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionLifecycle;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionSources;
import com.wikiaov.hero.internal.skills.persistence.entity.SkillEffectRow;
import com.wikiaov.hero.internal.skills.persistence.entity.SkillSnapshotRow;
import com.wikiaov.hero.internal.skills.persistence.entity.SkillTranslationRow;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

class HeroSkillSnapshotsTest {
    private final SkillsRevisionRepository revisions = mock(SkillsRevisionRepository.class);
    private final SkillIdentityRepository identities = mock(SkillIdentityRepository.class);
    private final SkillSnapshotRepository snapshots = mock(SkillSnapshotRepository.class);
    private final SkillTranslationRepository translations = mock(SkillTranslationRepository.class);
    private final SkillEffectRepository effects = mock(SkillEffectRepository.class);
    private final HeroSectionSources sources = mock(HeroSectionSources.class);
    private final HeroSkillSnapshots store = new HeroSkillSnapshots(revisions, identities, snapshots,
            translations, effects, new HeroSectionLifecycle(), sources);

    @Test
    void loadsTranslationsAndEffectsOnceForTheWholeSkillSetWithoutMixingSkillKeys() {
        var id = UUID.randomUUID();
        var hero = UUID.randomUUID();
        var ids = List.of(id);
        when(sources.find(HeroSection.SKILLS, id)).thenReturn(List.of());
        when(snapshots.findBySkillSetRevisionIdIn(ids, Sort.by("displayOrder"))).thenReturn(List.of(
                new SkillSnapshotRow(id, hero, "passive", "PASSIVE", null, 0, null),
                new SkillSnapshotRow(id, hero, "skill-1", "ACTIVE", null, 1, null)));
        when(translations.findBySkillSetRevisionIdIn(ids, Sort.by("locale"))).thenReturn(List.of(
                new SkillTranslationRow(id, "skill-1", "en-US", "Strike", "Active skill"),
                new SkillTranslationRow(id, "passive", "vi-VN", "Nội tại", "Passive skill"),
                new SkillTranslationRow(id, "skill-1", "vi-VN", "Chiêu một", "Active skill")));
        when(effects.findBySkillSetRevisionIdIn(ids, Sort.by("effectOrder"))).thenReturn(List.of(
                new SkillEffectRow(id, "skill-1", 0, "DAMAGE", Map.of("amount", 10)),
                new SkillEffectRow(id, "passive", 0, "HEAL", Map.of("amount", 5))));

        var content = store.content(id);

        assertThat(content.skills()).extracting(Skill::skillKey).containsExactly("passive", "skill-1");
        assertThat(content.skills().getFirst().translations()).extracting(SkillTranslation::name)
                .containsExactly("Nội tại");
        assertThat(content.skills().getLast().translations()).extracting(SkillTranslation::locale)
                .containsExactly("en-US", "vi-VN");
        assertThat(content.skills().getFirst().effects()).extracting(Effect::effectType).containsExactly("HEAL");
        assertThat(content.skills().getLast().effects()).extracting(Effect::effectType).containsExactly("DAMAGE");
        verify(translations).findBySkillSetRevisionIdIn(ids, Sort.by("locale"));
        verify(effects).findBySkillSetRevisionIdIn(ids, Sort.by("effectOrder"));
        verifyNoMoreInteractions(translations, effects);
    }

    @Test
    void emptySkillSetsDoNotQueryChildTables() {
        var id = UUID.randomUUID();
        when(sources.find(HeroSection.SKILLS, id)).thenReturn(List.of());
        when(snapshots.findBySkillSetRevisionIdIn(List.of(id), Sort.by("displayOrder"))).thenReturn(List.of());

        assertThat(store.content(id).skills()).isEmpty();

        verifyNoInteractions(translations, effects);
    }
}
