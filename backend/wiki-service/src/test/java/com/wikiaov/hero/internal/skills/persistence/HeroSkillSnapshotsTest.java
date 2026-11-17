package com.wikiaov.hero.internal.skills.persistence;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.wikiaov.access.Actor;
import com.wikiaov.access.ActorType;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionLifecycle;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionSources;
import com.wikiaov.hero.internal.skills.persistence.entity.SkillEffectRow;
import com.wikiaov.hero.internal.skills.persistence.entity.SkillSnapshotRow;
import com.wikiaov.hero.internal.skills.persistence.entity.SkillStateIconRow;
import com.wikiaov.hero.internal.skills.persistence.entity.SkillTraitRow;
import com.wikiaov.hero.internal.skills.persistence.entity.SkillTraitSkillRow;
import com.wikiaov.hero.internal.skills.persistence.entity.SkillTraitTranslationRow;
import com.wikiaov.hero.internal.skills.persistence.entity.SkillTranslationRow;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Sort;

class HeroSkillSnapshotsTest {
    private final SkillsRevisionRepository revisions = mock(SkillsRevisionRepository.class);
    private final SkillIdentityRepository identities = mock(SkillIdentityRepository.class);
    private final SkillSnapshotRepository snapshots = mock(SkillSnapshotRepository.class);
    private final SkillTranslationRepository translations = mock(SkillTranslationRepository.class);
    private final SkillEffectRepository effects = mock(SkillEffectRepository.class);
    private final SkillStateIconRepository stateIcons = mock(SkillStateIconRepository.class);
    private final SkillTraitRepository traits = mock(SkillTraitRepository.class);
    private final SkillTraitSkillRepository traitSkills = mock(SkillTraitSkillRepository.class);
    private final SkillTraitTranslationRepository traitTexts = mock(SkillTraitTranslationRepository.class);
    private final HeroSectionSources sources = mock(HeroSectionSources.class);
    private final HeroSkillSnapshots store = new HeroSkillSnapshots(revisions, identities, snapshots,
            translations, effects, stateIcons, traits, traitSkills, traitTexts, new HeroSectionLifecycle(), sources);

    @Test
    void readsTraitsPerSkillSetInTheFixedTraitOrderWithTheirSkillsAndDetails() {
        var first = UUID.randomUUID();
        var second = UUID.randomUUID();
        var ids = List.of(first, second);
        when(traits.findBySkillSetRevisionIdIn(ids)).thenReturn(List.of(
                SkillTraitRow.of(first, TraitCode.HARD_CC), SkillTraitRow.of(first, TraitCode.TRUE_DAMAGE),
                SkillTraitRow.of(second, TraitCode.DASH)));
        when(traitSkills.findBySkillSetRevisionIdIn(ids)).thenReturn(List.of(
                SkillTraitSkillRow.of(first, TraitCode.HARD_CC, "skill-2"),
                SkillTraitSkillRow.of(first, TraitCode.HARD_CC, "skill-1"),
                SkillTraitSkillRow.of(second, TraitCode.DASH, "skill-1")));
        when(traitTexts.findBySkillSetRevisionIdIn(ids)).thenReturn(List.of(
                SkillTraitTranslationRow.of(first, TraitCode.HARD_CC, "vi-VN", "Hào hoa (choáng 0.75 giây)")));

        var result = store.traits(ids);

        assertThat(result.get(first)).extracting(Trait::code).containsExactly(TraitCode.TRUE_DAMAGE,
                TraitCode.HARD_CC);
        assertThat(result.get(first).getLast().skillKeys()).containsExactly("skill-1", "skill-2");
        assertThat(result.get(first).getLast().translations()).extracting(TraitTranslation::detail)
                .containsExactly("Hào hoa (choáng 0.75 giây)");
        assertThat(result.get(first).getFirst().skillKeys()).isEmpty();
        assertThat(result.get(second)).extracting(Trait::code).containsExactly(TraitCode.DASH);
    }

    @Test
    void loadsTranslationsAndEffectsOnceForTheWholeSkillSetWithoutMixingSkillKeys() {
        var id = UUID.randomUUID();
        var hero = UUID.randomUUID();
        var ids = List.of(id);
        when(sources.find(HeroSection.SKILLS, List.of(id))).thenReturn(Map.of());
        when(snapshots.findBySkillSetRevisionIdIn(ids, Sort.by("displayOrder"))).thenReturn(List.of(
                new SkillSnapshotRow(id, hero, "passive", "PASSIVE", null, 0, null),
                new SkillSnapshotRow(id, hero, "skill-1", "ACTIVE", null, 1, null)));
        when(translations.findBySkillSetRevisionIdIn(ids, Sort.by("locale"))).thenReturn(List.of(
                new SkillTranslationRow(id, "skill-1", "en-US", "Strike", "Active skill", null),
                new SkillTranslationRow(id, "passive", "vi-VN", "Nội tại", "Passive skill", null),
                new SkillTranslationRow(id, "skill-1", "vi-VN", "Chiêu một", "Active skill",
                        "Lướt tới và hất tung mục tiêu.")));
        when(effects.findBySkillSetRevisionIdIn(ids, Sort.by("effectOrder"))).thenReturn(List.of(
                new SkillEffectRow(id, "skill-1", 0, "DAMAGE", Map.of("amount", 10)),
                new SkillEffectRow(id, "passive", 0, "HEAL", Map.of("amount", 5))));
        var sea = UUID.randomUUID();
        var storm = UUID.randomUUID();
        when(stateIcons.findBySkillSetRevisionIdIn(ids, Sort.by("iconOrder"))).thenReturn(List.of(
                new SkillStateIconRow(id, "skill-1", 0, sea, "Hải quái"),
                new SkillStateIconRow(id, "skill-1", 1, storm, "Bão tố")));

        var content = store.content(id);

        assertThat(content.skills()).extracting(Skill::skillKey).containsExactly("passive", "skill-1");
        assertThat(content.skills().getFirst().translations()).extracting(SkillTranslation::name)
                .containsExactly("Nội tại");
        assertThat(content.skills().getLast().translations()).extracting(SkillTranslation::locale)
                .containsExactly("en-US", "vi-VN");
        assertThat(content.skills().getLast().translations()).extracting(SkillTranslation::summary)
                .containsExactly(null, "Lướt tới và hất tung mục tiêu.");
        assertThat(content.skills().getFirst().effects()).extracting(Effect::effectType).containsExactly("HEAL");
        assertThat(content.skills().getLast().effects()).extracting(Effect::effectType).containsExactly("DAMAGE");
        assertThat(content.skills().getFirst().stateIcons()).isEmpty();
        assertThat(content.skills().getLast().stateIcons()).containsExactly(new SkillStateIcon(sea, "Hải quái"),
                new SkillStateIcon(storm, "Bão tố"));
        verify(translations).findBySkillSetRevisionIdIn(ids, Sort.by("locale"));
        verify(effects).findBySkillSetRevisionIdIn(ids, Sort.by("effectOrder"));
        verify(stateIcons).findBySkillSetRevisionIdIn(ids, Sort.by("iconOrder"));
        verifyNoMoreInteractions(translations, effects, stateIcons);
    }

    @Test
    void readsManySkillSetsInOneQueryEachWithoutMixingTheirRows() {
        UUID first = UUID.randomUUID(), second = UUID.randomUUID(), empty = UUID.randomUUID();
        var hero = UUID.randomUUID();
        var ids = List.of(first, second, empty);
        when(sources.find(HeroSection.SKILLS, ids)).thenReturn(Map.of(second, List.of(
                new Source("Fixture", null, null, Verification.VERIFIED, null))));
        when(snapshots.findBySkillSetRevisionIdIn(ids, Sort.by("displayOrder"))).thenReturn(List.of(
                new SkillSnapshotRow(first, hero, "same-key", "ACTIVE", null, 0, null),
                new SkillSnapshotRow(second, hero, "same-key", "ACTIVE", null, 0, null)));
        when(translations.findBySkillSetRevisionIdIn(ids, Sort.by("locale"))).thenReturn(List.of(
                new SkillTranslationRow(first, "same-key", "vi-VN", "Trước", "Bản trước", "Tóm tắt trước"),
                new SkillTranslationRow(second, "same-key", "vi-VN", "Sau", "Bản sau", null)));
        when(effects.findBySkillSetRevisionIdIn(ids, Sort.by("effectOrder"))).thenReturn(List.of(
                new SkillEffectRow(second, "same-key", 0, "DAMAGE", Map.of())));

        var contents = store.contents(ids);

        assertThat(contents.get(first).skills().getFirst().translations()).extracting(SkillTranslation::name)
                .containsExactly("Trước");
        assertThat(contents.get(first).skills().getFirst().translations().getFirst().summary())
                .isEqualTo("Tóm tắt trước");
        assertThat(contents.get(second).skills().getFirst().translations().getFirst().summary()).isNull();
        assertThat(contents.get(first).skills().getFirst().effects()).isEmpty();
        assertThat(contents.get(first).sources()).isEmpty();
        assertThat(contents.get(second).skills().getFirst().translations()).extracting(SkillTranslation::name)
                .containsExactly("Sau");
        assertThat(contents.get(second).skills().getFirst().effects()).hasSize(1);
        assertThat(contents.get(second).sources()).hasSize(1);
        assertThat(contents.get(empty).skills()).isEmpty();
    }

    @Test
    @SuppressWarnings("unchecked")
    void savesTheSummaryOfEachTranslationAndLeavesAMissingOneEmpty() {
        var hero = UUID.randomUUID();
        when(revisions.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
        when(identities.findById(any())).thenReturn(Optional.empty());
        var skill = new Skill("skill-1", SkillKind.ACTIVE, null, 0, null,
                List.of(new SkillTranslation("vi-VN", "Chiêu một", "Mô tả", "Lướt tới và hất tung mục tiêu."),
                        new SkillTranslation("en-US", "Strike", "Description")),
                List.of());

        store.create(hero, new Skills(List.of(skill), List.of()),
                new Actor("issuer", "editor", ActorType.HUMAN, null, Set.of()), Instant.EPOCH);

        var rows = ArgumentCaptor.forClass(List.class);
        verify(translations).saveAll(rows.capture());
        assertThat((List<SkillTranslationRow>) rows.getValue())
                .extracting(SkillTranslationRow::getLocale, SkillTranslationRow::getSummary)
                .containsExactly(tuple("vi-VN", "Lướt tới và hất tung mục tiêu."), tuple("en-US", null));
    }

    @Test
    void emptySkillSetsDoNotQueryChildTables() {
        var id = UUID.randomUUID();
        when(sources.find(HeroSection.SKILLS, List.of(id))).thenReturn(Map.of());
        when(snapshots.findBySkillSetRevisionIdIn(List.of(id), Sort.by("displayOrder"))).thenReturn(List.of());

        assertThat(store.content(id).skills()).isEmpty();

        verifyNoInteractions(translations, effects, stateIcons);
    }
}
