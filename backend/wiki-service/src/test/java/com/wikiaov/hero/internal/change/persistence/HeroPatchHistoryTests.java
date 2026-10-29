package com.wikiaov.hero.internal.change.persistence;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.wikiaov.access.Actor;
import com.wikiaov.access.ActorType;
import com.wikiaov.hero.internal.change.persistence.HeroPatchChangeSetRepository.Header;
import com.wikiaov.hero.internal.change.persistence.entity.HeroChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchAssessment;
import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchChangeSet;
import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchChangeTranslation;
import com.wikiaov.hero.internal.change.persistence.entity.MechanicChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.OtherChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.RoleChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.SkillChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.StatChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.VisualChangeClassification;
import com.wikiaov.hero.internal.domain.HeroChanges.*;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroContent.MediaRole;
import com.wikiaov.hero.internal.domain.HeroContent.Role;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class HeroPatchHistoryTests {
    private final HeroPatchChangeSetRepository sets = mock(HeroPatchChangeSetRepository.class);
    private final HeroPatchChangeTranslationRepository translations = mock(HeroPatchChangeTranslationRepository.class);
    private final HeroChangeClassificationRepository changes = mock(HeroChangeClassificationRepository.class);
    private final HeroPatchAssessmentRepository assessments = mock(HeroPatchAssessmentRepository.class);
    private final HeroPatchHistory history = new HeroPatchHistory(sets, translations, changes, assessments);

    @Test
    void batchesHistoryAndKeepsRequestedVietnameseAndAlphabeticalLocaleFallback() {
        UUID variant = UUID.randomUUID();
        var first = header();
        var second = header();
        var third = header();
        var ids = List.of(first.getId(), second.getId(), third.getId());
        var assessment = new HeroPatchAssessment();
        assessment.setChangeSetId(second.getId());
        assessment.setKind(Kind.BUFF);
        var fact = new OtherChangeClassification();
        fact.setChangeSetId(first.getId());
        when(sets.historyForVariant(variant)).thenReturn(List.of(first, second, third));
        when(assessments.findAllById(ids)).thenReturn(List.of(assessment));
        when(changes.findByChangeSetIdIn(ids)).thenReturn(List.of(fact));
        var copies = List.of(
                copy(first.getId(), "vi-VN"), copy(first.getId(), "en-US"), copy(first.getId(), "ja-JP"),
                copy(second.getId(), "de-DE"), copy(second.getId(), "vi-VN"),
                copy(third.getId(), "ja-JP"), copy(third.getId(), "de-DE"));
        when(translations.findByChangeSetIdIn(ids)).thenReturn(copies);

        var entries = history.forVariant(variant, "en-US");

        assertThat(entries).extracting(entry -> entry.header().getId()).containsExactlyElementsOf(ids);
        assertThat(entries).extracting(entry -> entry.translation().getLocale())
                .containsExactly("en-US", "vi-VN", "de-DE");
        assertThat(entries.getFirst().changes()).containsExactly(fact);
        assertThat(entries.getFirst().assessment()).isNull();
        assertThat(entries.get(1).assessment()).isSameAs(assessment);
        assertThat(entries.get(1).changes()).isEmpty();
        verify(sets).historyForVariant(variant);
        verify(assessments).findAllById(ids);
        verify(translations).findByChangeSetIdIn(ids);
        verify(changes).findByChangeSetIdIn(ids);
        verifyNoMoreInteractions(sets, assessments, translations, changes);
    }

    @Test
    void appendsAssignedIdentifiersWithoutMergeAndKeepsAllSubtypeFields() {
        UUID changeSet = UUID.randomUUID();
        UUID variant = UUID.randomUUID();
        UUID target = UUID.randomUUID();
        UUID asset = UUID.randomUUID();
        var actor = new Actor("issuer", "editor", ActorType.HUMAN, "Editor", Set.of());
        var at = Instant.parse("2026-10-20T03:00:00Z");
        var source = new com.wikiaov.hero.internal.domain.HeroChanges.Record(UUID.randomUUID(), null, null, null,
                target,
                List.of(new Summary("vi-VN", "Summary")), List.of(new OtherChange(Kind.OTHER, "Note")));
        history.create(changeSet, variant, source, at, actor);
        history.appendTranslation(changeSet, source.summaryTranslations().getFirst());
        List<Change> facts = List.of(
                new StatChange(Kind.NERF, "HP", new BigDecimal("3500"), new BigDecimal("3400"), "POINT"),
                new SkillChange(Kind.REWORK, "skill-1-1", "description", null, "Updated"),
                new RoleChange(Kind.ADJUSTMENT, Role.WARRIOR, true),
                new VisualChange(Kind.OTHER, MediaRole.HEAD, null, asset),
                new MechanicChange(Kind.FIX, "landing", "Fixed landing"),
                new OtherChange(Kind.OTHER, "Other note"));
        for (int index = 0; index < facts.size(); index++)
            history.appendChange(changeSet, index, facts.get(index));

        var savedSet = ArgumentCaptor.forClass(HeroPatchChangeSet.class);
        verify(sets).saveAndFlush(savedSet.capture());
        assertThat(savedSet.getValue().getId()).isEqualTo(changeSet);
        assertThat(savedSet.getValue().getCreatedAt()).isEqualTo(at);
        assertThat(savedSet.getValue().getCreatedByIssuer()).isEqualTo("issuer");
        assertThat(savedSet.getValue().getCreatedBySubject()).isEqualTo("editor");
        assertThat(savedSet.getValue().isNew()).isTrue();
        assertThat(savedSet.getValue().getSourceKind()).isEqualTo(ChangeSource.SNAPSHOT);
        var savedCopy = ArgumentCaptor.forClass(HeroPatchChangeTranslation.class);
        verify(translations).save(savedCopy.capture());
        assertThat(savedCopy.getValue().getId()).isEqualTo(new HeroPatchChangeTranslation.Key(changeSet, "vi-VN"));
        assertThat(savedCopy.getValue().isNew()).isTrue();
        var savedFacts = ArgumentCaptor.forClass(HeroChangeClassification.class);
        verify(changes, times(6)).save(savedFacts.capture());
        assertThat(savedFacts.getAllValues()).extracting(HeroChangeClassification::getSortOrder)
                .containsExactly(0, 1, 2, 3, 4, 5);
        assertThat(savedFacts.getAllValues()).allSatisfy(value -> {
            assertThat(value.getId()).isNotNull();
            assertThat(value.getChangeSetId()).isEqualTo(changeSet);
            assertThat(value.isNew()).isTrue();
        });
        assertThat(savedFacts.getAllValues().get(0)).isInstanceOfSatisfying(StatChangeClassification.class, value -> {
            assertThat(value.getOldValue()).isEqualByComparingTo("3500");
            assertThat(value.getNewValue()).isEqualByComparingTo("3400");
            assertThat(value.getStatKey()).isEqualTo("HP");
            assertThat(value.getUnitCode()).isEqualTo("POINT");
        });
        assertThat(savedFacts.getAllValues().get(1)).isInstanceOfSatisfying(SkillChangeClassification.class, value -> {
            assertThat(value.getSkillKey()).isEqualTo("skill-1-1");
            assertThat(value.getFieldKey()).isEqualTo("description");
            assertThat(value.getOldValue()).isNull();
            assertThat(value.getNewValue()).isEqualTo("Updated");
        });
        assertThat(savedFacts.getAllValues().get(2)).isInstanceOfSatisfying(RoleChangeClassification.class, value -> {
            assertThat(value.getRoleCode()).isEqualTo("WARRIOR");
            assertThat(value.isAdded()).isTrue();
        });
        assertThat(savedFacts.getAllValues().get(3)).isInstanceOfSatisfying(VisualChangeClassification.class, value -> {
            assertThat(value.getMediaRole()).isEqualTo("HEAD");
            assertThat(value.getOldAssetId()).isNull();
            assertThat(value.getNewAssetId()).isEqualTo(asset);
        });
        assertThat(savedFacts.getAllValues().get(4)).isInstanceOfSatisfying(MechanicChangeClassification.class,
                value -> {
                    assertThat(value.getMechanicKey()).isEqualTo("landing");
                    assertThat(value.getDescription()).isEqualTo("Fixed landing");
                });
        assertThat(savedFacts.getAllValues().get(5)).isInstanceOfSatisfying(OtherChangeClassification.class,
                value -> assertThat(value.getDescription()).isEqualTo("Other note"));
    }

    private static Header header() {
        var value = mock(Header.class);
        when(value.getId()).thenReturn(UUID.randomUUID());
        return value;
    }

    private static HeroPatchChangeTranslation copy(UUID changeSetId, String locale) {
        var value = new HeroPatchChangeTranslation();
        value.setChangeSetId(changeSetId);
        value.setLocale(locale);
        value.setSummary(locale + " summary");
        return value;
    }
}
