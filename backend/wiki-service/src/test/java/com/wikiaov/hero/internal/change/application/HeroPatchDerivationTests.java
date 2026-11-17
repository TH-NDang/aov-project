package com.wikiaov.hero.internal.change.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.wikiaov.hero.internal.application.response.HeroPatchView.Direction;
import com.wikiaov.hero.internal.application.response.HeroPatchView.Provenance;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.change.persistence.HeroPatchChangeSetRepository.Header;
import com.wikiaov.hero.internal.change.persistence.HeroPatchHistory;
import com.wikiaov.hero.internal.change.persistence.HeroPatchHistory.Entry;
import com.wikiaov.hero.internal.change.persistence.entity.SkillChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.StatChangeClassification;
import com.wikiaov.hero.internal.domain.HeroContent.Cause;
import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroContent.Role;
import com.wikiaov.hero.internal.domain.HeroContent.Stat;
import com.wikiaov.hero.internal.domain.HeroContent.Stats;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchVariantReference;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.RevisionState;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class HeroPatchDerivationTests {
    private final HeroStore store = mock(HeroStore.class);
    private final HeroSections sections = mock(HeroSections.class);
    private final HeroPatchHistory history = mock(HeroPatchHistory.class);
    private final GameplayContexts contexts = mock(GameplayContexts.class);
    private final HeroPatchDerivation derivation = new HeroPatchDerivation(store, sections, history, contexts);
    private final UUID hero = UUID.randomUUID();
    private final UUID ruleset = UUID.randomUUID();
    private final PatchVariantReference past = variant(1);
    private final PatchVariantReference middle = variant(2);
    private final PatchVariantReference current = variant(3);
    private HeroRevisionView old;
    private HeroRevisionView baseline;
    private Entry middleChange;
    private Entry currentChange;

    @BeforeEach
    void setUp() {
        old = revision(hero, ruleset, RevisionState.PUBLISHED, past.id(), 1);
        baseline = revision(hero, ruleset, RevisionState.PUBLISHED, current.id(), 2);
        when(store.revisions(hero)).thenReturn(List.of(old, baseline));
        when(contexts.rulesetVariants(ruleset)).thenReturn(List.of(past, middle, current));
        for (var variant : List.of(past, middle, current))
            when(contexts.variant(variant.id())).thenReturn(variant);
        when(sections.content(eq(HeroSection.COMBAT_STATS), any())).thenReturn(new Stats(
                List.of(new Stat("HP", new BigDecimal("3500"), null, new BigDecimal("100"), "POINT")), List.of()));
        when(sections.content(eq(HeroSection.PROFILE), any()))
                .thenReturn(new Profile(List.of(), Set.of(Role.ASSASSIN), List.of()));

        middleChange = change(middle.id(), "8", "6");
        currentChange = change(current.id(), "6", "5");
        when(history.forHero(hero, "vi-VN")).thenReturn(List.of(middleChange, currentChange));
    }

    @Test
    void selectedBaselineRewindsEvenWhenAnOlderPublishedSnapshotExists() {
        var view = derivation.at(hero, past.id(), baseline.id());

        assertThat(view.anchor().direction()).isEqualTo(Direction.BACKWARD);
        assertThat(view.anchor().revisionId()).isEqualTo(baseline.id());
        assertThat(view.appliedChangeSetIds()).containsExactly(currentChange.header().getId(),
                middleChange.header().getId());
        assertThat(view.skillFields()).singleElement().satisfies(field -> {
            assertThat(field.value()).isEqualTo("8");
            assertThat(field.provenance()).isEqualTo(Provenance.DERIVED);
            assertThat(field.changeSetId()).isEqualTo(middleChange.header().getId());
        });
        assertThat(view.stats()).singleElement().satisfies(stat -> {
            assertThat(stat.baseValue()).isEqualByComparingTo("3500");
            assertThat(stat.provenance()).isEqualTo(Provenance.CARRIED);
        });
        assertThat(view.roles()).singleElement()
                .satisfies(role -> assertThat(role.provenance()).isEqualTo(Provenance.CARRIED));
        verify(store).revisions(hero);
        verifyNoMoreInteractions(store);
    }

    @Test
    void backwardRangeExcludesTheTargetPatchAndIncludesTheBaselinePatch() {
        var view = derivation.at(hero, middle.id(), baseline.id());

        assertThat(view.appliedChangeSetIds()).containsExactly(currentChange.header().getId());
        assertThat(view.skillFields()).singleElement().satisfies(field -> assertThat(field.value()).isEqualTo("6"));
    }

    @Test
    void explicitAnchorSupportsExactAndForwardViewsWithoutChangingAutomaticSelection() {
        var automatic = derivation.at(hero, middle.id(), null);
        assertThat(automatic.anchor().revisionId()).isEqualTo(old.id());
        assertThat(automatic.anchor().direction()).isEqualTo(Direction.FORWARD);

        var forward = derivation.at(hero, current.id(), old.id());
        assertThat(forward.appliedChangeSetIds()).containsExactly(middleChange.header().getId(),
                currentChange.header().getId());
        assertThat(forward.skillFields()).singleElement().satisfies(field -> assertThat(field.value()).isEqualTo("5"));

        var exact = derivation.at(hero, current.id(), baseline.id());
        assertThat(exact.anchor().direction()).isEqualTo(Direction.EXACT);
        assertThat(exact.appliedChangeSetIds()).isEmpty();
        assertThat(exact.skillFields()).isEmpty();
        assertThat(exact.stats()).singleElement()
                .satisfies(stat -> assertThat(stat.provenance()).isEqualTo(Provenance.OBSERVED));
    }

    @Test
    void aChangeSetKeepsThePercentUnknownBecauseItOnlyRecordsTheNumber() {
        when(sections.content(eq(HeroSection.COMBAT_STATS), any())).thenReturn(new Stats(
                List.of(new Stat("ARMOR", new BigDecimal("150"), new BigDecimal("20"), null, "POINT")), List.of()));
        var armor = new StatChangeClassification();
        armor.setStatKey("ARMOR");
        armor.setUnitCode("POINT");
        armor.setOldValue(new BigDecimal("150"));
        armor.setNewValue(new BigDecimal("160"));
        var header = mock(Header.class);
        when(header.getId()).thenReturn(UUID.randomUUID());
        when(header.getPatchVariantId()).thenReturn(current.id());
        when(history.forHero(hero, "vi-VN"))
                .thenReturn(List.of(new Entry(header, null, null, List.of(armor), Map.of())));

        assertThat(derivation.at(hero, current.id(), baseline.id()).stats()).singleElement()
                .satisfies(stat -> assertThat(stat.percentValue()).isEqualByComparingTo("20"));
        assertThat(derivation.at(hero, current.id(), old.id()).stats()).singleElement().satisfies(stat -> {
            assertThat(stat.baseValue()).isEqualByComparingTo("160");
            assertThat(stat.percentValue()).isNull();
        });
    }

    @Test
    void refusesDraftDiscardedForeignAndUndatedAnchorsInsteadOfFallingBack() {
        var invalid = List.of(
                revision(hero, ruleset, RevisionState.DRAFT, current.id(), 3),
                revision(hero, ruleset, RevisionState.DISCARDED, current.id(), 4),
                revision(UUID.randomUUID(), ruleset, RevisionState.PUBLISHED, current.id(), 5),
                revision(hero, UUID.randomUUID(), RevisionState.PUBLISHED, current.id(), 6),
                revision(hero, ruleset, RevisionState.PUBLISHED, null, 7),
                revision(hero, ruleset, RevisionState.PUBLISHED, UUID.randomUUID(), 8));
        var revisions = new ArrayList<>(invalid);
        revisions.add(old);
        revisions.add(baseline);
        when(store.revisions(hero)).thenReturn(revisions);

        for (var candidate : invalid)
            assertThatThrownBy(() -> derivation.at(hero, past.id(), candidate.id())).isInstanceOf(ApiException.class)
                    .hasMessageContaining("The anchor must be a published revision");
        assertThatThrownBy(() -> derivation.at(hero, past.id(), UUID.randomUUID())).isInstanceOf(ApiException.class);
        verifyNoInteractions(sections, history);
    }

    @Test
    void missingHistoricalFieldsAreNotFabricatedAndOtherRulesetsAreIgnored() {
        var foreignChange = change(UUID.randomUUID(), "20", "10");
        when(history.forHero(hero, "vi-VN")).thenReturn(List.of(foreignChange));

        var view = derivation.at(hero, past.id(), baseline.id());

        assertThat(view.skillFields()).isEmpty();
        assertThat(view.appliedChangeSetIds()).isEmpty();
        assertThat(view.stats()).allSatisfy(stat -> assertThat(stat.provenance()).isEqualTo(Provenance.CARRIED));
    }

    private PatchVariantReference variant(long ordinal) {
        return new PatchVariantReference(UUID.randomUUID(), UUID.randomUUID(), ruleset, UUID.randomUUID(), ordinal,
                true);
    }

    private HeroRevisionView revision(UUID heroId, UUID rulesetId, RevisionState state, UUID patch, long number) {
        return new HeroRevisionView(UUID.randomUUID(), heroId, rulesetId, number, state, 1, number, Instant.now(),
                Cause.DATA_BASELINE, null, patch,
                Map.of(HeroSection.COMBAT_STATS, UUID.randomUUID(), HeroSection.PROFILE, UUID.randomUUID()));
    }

    private Entry change(UUID variant, String before, String after) {
        var header = mock(Header.class);
        when(header.getId()).thenReturn(UUID.randomUUID());
        when(header.getPatchVariantId()).thenReturn(variant);
        var skill = new SkillChangeClassification();
        skill.setSkillKey("skill-1-1");
        skill.setFieldKey("cooldown");
        skill.setOldValue(before);
        skill.setNewValue(after);
        return new Entry(header, null, null, List.of(skill), Map.of());
    }
}
