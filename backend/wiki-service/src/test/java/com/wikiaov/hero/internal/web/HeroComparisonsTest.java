package com.wikiaov.hero.internal.web;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.application.service.HeroComparisons;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.persistence.HeroSections;
import com.wikiaov.hero.internal.persistence.HeroStore;
import com.wikiaov.platform.ApiException;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class HeroComparisonsTest {
    private final HeroStore store = mock(HeroStore.class);
    private final HeroSections sections = mock(HeroSections.class);
    private final HeroComparisons comparisons = new HeroComparisons(store, sections, JsonMapper.builder().build());
    private final UUID hero = UUID.randomUUID(), ruleset = UUID.randomUUID();

    @Test
    void independentBaselineDoesNotInventChangesFromAnEmptyPast() {
        var target = revision(UUID.randomUUID(), null, ruleset, HeroSection.PROFILE);
        when(sections.content(HeroSection.PROFILE, target.sections().get(HeroSection.PROFILE)))
                .thenReturn(new Profile(List.of(new ProfileTranslation("vi-VN", "Airi", null, null, null)), Set.of(),
                        List.of()));
        var result = comparisons.compare(hero, target.id(), null);
        assertThat(result.status()).isEqualTo("BASELINE_ONLY");
        assertThat(result.from()).isNull();
        assertThat(result.before()).isEmpty();
        assertThat(result.after()).containsKey(HeroSection.PROFILE);
        assertThat(result.changes()).isEmpty();
    }

    @Test
    void inheritedSourceMatchesSkillsByStableKeyAndTranslationsByLocale() {
        var source = revision(UUID.randomUUID(), null, ruleset, HeroSection.SKILLS);
        var target = revision(UUID.randomUUID(), source.id(), ruleset, HeroSection.SKILLS);
        when(sections.content(HeroSection.SKILLS, source.sections().get(HeroSection.SKILLS)))
                .thenReturn(new Skills(List.of(skill("passive", "Old passive", "Same"),
                        skill("skill-1", "Same", "Old English")), List.of()));
        when(sections.content(HeroSection.SKILLS, target.sections().get(HeroSection.SKILLS)))
                .thenReturn(new Skills(List.of(skill("skill-1", "Same", "New English"),
                        skill("passive", "New passive", "Same")), List.of()));
        var result = comparisons.compare(hero, target.id(), null);
        assertThat(result.status()).isEqualTo("AVAILABLE");
        assertThat(result.from().id()).isEqualTo(source.id());
        assertThat(result.changes()).extracting(change -> change.path())
                .containsExactly("/skills/passive/translations/vi-VN/description",
                        "/skills/skill-1/translations/en-US/description");
        assertThat(result.changes()).allMatch(change -> change.section() == HeroSection.SKILLS
                && change.kind().equals("CHANGED"));
    }

    @Test
    void sourceEvidenceAndNumericScaleDoNotProduceGameplayDifferences() {
        var source = revision(UUID.randomUUID(), null, ruleset, HeroSection.COMBAT_STATS);
        var target = revision(UUID.randomUUID(), source.id(), ruleset, HeroSection.COMBAT_STATS);
        when(sections.content(HeroSection.COMBAT_STATS, source.sections().get(HeroSection.COMBAT_STATS)))
                .thenReturn(new Stats(List.of(new Stat("HP", new BigDecimal("3500.000"), null, "POINT")),
                        List.of(new Source("First observation", null, null, Verification.UNVERIFIED, null))));
        when(sections.content(HeroSection.COMBAT_STATS, target.sections().get(HeroSection.COMBAT_STATS)))
                .thenReturn(new Stats(List.of(new Stat("HP", new BigDecimal("3500"), null, "POINT")),
                        List.of(new Source("Second observation", null, null, Verification.VERIFIED, null))));
        assertThat(comparisons.compare(hero, target.id(), null).changes()).isEmpty();
    }

    @Test
    void captureEvidenceChangesDoNotTurnHealthAdjustmentIntoSkillChanges() {
        var source = revision(UUID.randomUUID(), null, ruleset, HeroSection.COMBAT_STATS, HeroSection.SKILLS);
        var target = revision(UUID.randomUUID(), source.id(), ruleset, HeroSection.COMBAT_STATS, HeroSection.SKILLS);
        var beforeSkills = new Skills(List.of(capturedSkill("skill-1", capture("before.png", 3500, false)),
                capturedSkill("skill-2", capture("before.png", 3500, false))), List.of());
        var afterSkills = new Skills(List.of(capturedSkill("skill-1", capture("after.png", 3600, true)),
                capturedSkill("skill-2", capture("after.png", 3600, true))), List.of());
        when(sections.content(HeroSection.SKILLS, source.sections().get(HeroSection.SKILLS))).thenReturn(beforeSkills);
        when(sections.content(HeroSection.SKILLS, target.sections().get(HeroSection.SKILLS))).thenReturn(afterSkills);
        when(sections.content(HeroSection.COMBAT_STATS, source.sections().get(HeroSection.COMBAT_STATS)))
                .thenReturn(new Stats(List.of(new Stat("HP", new BigDecimal("3500"), null, "POINT")), List.of()));
        when(sections.content(HeroSection.COMBAT_STATS, target.sections().get(HeroSection.COMBAT_STATS)))
                .thenReturn(new Stats(List.of(new Stat("HP", new BigDecimal("3600"), null, "POINT")), List.of()));

        var result = comparisons.compare(hero, target.id(), null);
        assertThat(result.changes()).singleElement().satisfies(change -> {
            assertThat(change.section()).isEqualTo(HeroSection.COMBAT_STATS);
            assertThat(change.path()).isEqualTo("/values/HP/baseValue");
        });
        assertThat(result.before().get(HeroSection.SKILLS)).isSameAs(beforeSkills);
        assertThat(result.after().get(HeroSection.SKILLS)).isSameAs(afterSkills);
        assertThat(beforeSkills.skills().getFirst().effects().getFirst().metadata()).containsEntry("sourceImage",
                "before.png");
        assertThat(afterSkills.skills().getFirst().effects().getFirst().metadata()).containsEntry("sourceImage",
                "after.png");
    }

    @Test
    void observedSkillValuesLabelsAndRawTableDisplaysStillProduceDifferences() {
        var source = revision(UUID.randomUUID(), null, ruleset, HeroSection.SKILLS);
        var target = revision(UUID.randomUUID(), source.id(), ruleset, HeroSection.SKILLS);
        var before = capture("before.png", 3500, false);
        when(sections.content(HeroSection.SKILLS, source.sections().get(HeroSection.SKILLS)))
                .thenReturn(new Skills(List.of(capturedSkill("skill-1", before)), List.of()));
        List<Map<String, Object>> updates = List.of(
                Map.of("cooldown", Map.of("seconds", 9, "display", "H.chiêu: 9s")),
                Map.of("energyCost", Map.of("value", 20, "label", "N.lượng")),
                Map.of("levelTable", levelTable("ST gốc", "300", true)),
                Map.of("levelTable", levelTable("Sát thương", "280", true)),
                Map.of("tags", List.of("Vật lý", "Làm chậm")));
        for (var update : updates) {
            var after = capture("after.png", 3600, true);
            after.putAll(update);
            when(sections.content(HeroSection.SKILLS, target.sections().get(HeroSection.SKILLS)))
                    .thenReturn(new Skills(List.of(capturedSkill("skill-1", after)), List.of()));
            var result = comparisons.compare(hero, target.id(), null);
            assertThat(result.changes()).as("Observed field %s remains comparable", update.keySet())
                    .isNotEmpty().allSatisfy(change -> {
                        assertThat(change.section()).isEqualTo(HeroSection.SKILLS);
                        assertThat(change.path()).startsWith("/skills/skill-1/effects/SOURCE_SNAPSHOT/metadata/");
                    });
            assertThat(result.changes().toString()).doesNotContain("sourceImage", "rawAttributes", "reviewFlags",
                    "review_required", "reviewRequired", "before.png", "after.png");
        }
    }

    @Test
    void changedCaptureValuesAreProjectedWithoutDiscardingFullSnapshotEvidence() {
        var source = revision(UUID.randomUUID(), null, ruleset, HeroSection.SKILLS);
        var target = revision(UUID.randomUUID(), source.id(), ruleset, HeroSection.SKILLS);
        var beforeCapture = capture("before.png", 3500, false);
        var afterCapture = capture("after.png", 3600, true);
        afterCapture.put("cooldown", Map.of("seconds", 9, "display", "H.chiêu: 9s"));
        afterCapture.put("levelTable", levelTable("ST gốc", "300", true));
        var beforeSkills = new Skills(List.of(capturedSkill("skill-1", beforeCapture)), List.of());
        var afterSkills = new Skills(List.of(capturedSkill("skill-1", afterCapture)), List.of());
        when(sections.content(HeroSection.SKILLS, source.sections().get(HeroSection.SKILLS))).thenReturn(beforeSkills);
        when(sections.content(HeroSection.SKILLS, target.sections().get(HeroSection.SKILLS))).thenReturn(afterSkills);

        var result = comparisons.compare(hero, target.id(), null);

        assertThat(result.changes()).extracting(change -> change.path()).containsExactly(
                "/skills/skill-1/effects/SOURCE_SNAPSHOT/metadata/cooldown/display",
                "/skills/skill-1/effects/SOURCE_SNAPSHOT/metadata/cooldown/seconds",
                "/skills/skill-1/effects/SOURCE_SNAPSHOT/metadata/levelTable/rows");
        assertThat(result.changes().get(1).before()).isEqualTo(new BigDecimal("8"));
        assertThat(result.changes().get(1).after()).isEqualTo(new BigDecimal("9"));
        assertThat(result.changes().toString()).doesNotContain("sourceImage", "rawAttributes", "reviewFlags",
                "review_required", "reviewRequired", "before.png", "after.png");
        assertThat(result.before().get(HeroSection.SKILLS)).isSameAs(beforeSkills);
        assertThat(result.after().get(HeroSection.SKILLS)).isSameAs(afterSkills);
        assertThat(beforeSkills.skills().getFirst().effects().getFirst().metadata()).isEqualTo(beforeCapture)
                .containsEntry("sourceImage", "before.png").containsKey("rawAttributes");
        assertThat(afterSkills.skills().getFirst().effects().getFirst().metadata()).isEqualTo(afterCapture)
                .containsEntry("sourceImage", "after.png").containsKey("rawAttributes");
    }

    @Test
    void captureOnlyEvidenceAndReviewFlagsDoNotCreateAnEffectChange() {
        var source = revision(UUID.randomUUID(), null, ruleset, HeroSection.SKILLS);
        var target = revision(UUID.randomUUID(), source.id(), ruleset, HeroSection.SKILLS);
        var base = skill("skill-1", "Same", "Same");
        var evidence = Map.<String, Object>of("sourceImage", "new.png", "reviewFlags", List.of("needs-review"),
                "rawAttributes", Map.of("HP", 3500), "cooldown", Map.of(), "tags", List.of());
        when(sections.content(HeroSection.SKILLS, source.sections().get(HeroSection.SKILLS)))
                .thenReturn(new Skills(List.of(base), List.of()));
        when(sections.content(HeroSection.SKILLS, target.sections().get(HeroSection.SKILLS)))
                .thenReturn(new Skills(List.of(capturedSkill("skill-1", evidence)), List.of()));
        assertThat(comparisons.compare(hero, target.id(), null).changes()).isEmpty();
    }

    @Test
    void explicitSourceCannotMixGameplayRulesets() {
        var source = revision(UUID.randomUUID(), null, UUID.randomUUID(), HeroSection.PROFILE);
        var target = revision(UUID.randomUUID(), null, ruleset, HeroSection.PROFILE);
        assertThatThrownBy(() -> comparisons.compare(hero, target.id(), source.id()))
                .isInstanceOf(ApiException.class).hasMessageContaining("same hero and ruleset");
    }

    @Test
    void additionsAndRemovalsRemainDistinctFromModification() {
        var source = revision(UUID.randomUUID(), null, ruleset, HeroSection.MEDIA_BINDINGS);
        var target = revision(UUID.randomUUID(), source.id(), ruleset, HeroSection.MEDIA_BINDINGS);
        UUID head = UUID.randomUUID(), portrait = UUID.randomUUID();
        when(sections.content(HeroSection.MEDIA_BINDINGS, source.sections().get(HeroSection.MEDIA_BINDINGS)))
                .thenReturn(new Bindings(Map.of(MediaRole.HEAD, head), List.of()));
        when(sections.content(HeroSection.MEDIA_BINDINGS, target.sections().get(HeroSection.MEDIA_BINDINGS)))
                .thenReturn(new Bindings(Map.of(MediaRole.PORTRAIT, portrait), List.of()));
        var result = comparisons.compare(hero, target.id(), null);
        assertThat(result.changes()).extracting(change -> change.kind()).containsExactly("REMOVED", "ADDED");
    }

    private HeroRevisionView revision(UUID id, UUID source, UUID revisionRuleset, HeroSection... revisionSections) {
        Map<HeroSection, UUID> contentIds = new EnumMap<>(HeroSection.class);
        for (var section : revisionSections)
            contentIds.put(section, UUID.randomUUID());
        var revision = new HeroRevisionView(id, hero, revisionRuleset, 1, "DRAFT", 1, null, null,
                source == null ? Cause.DATA_BASELINE : Cause.GAME_PATCH, source, UUID.randomUUID(),
                contentIds);
        when(store.revision(hero, id)).thenReturn(revision);
        return revision;
    }

    private static Skill skill(String key, String vietnamese, String english) {
        return new Skill(key, SkillKind.ACTIVE, null, 0, null,
                List.of(new SkillTranslation("en-US", key, english), new SkillTranslation("vi-VN", key, vietnamese)),
                List.of());
    }

    private static Skill capturedSkill(String key, Map<String, Object> metadata) {
        var base = skill(key, "Same", "Same");
        return new Skill(base.skillKey(), base.kind(), base.formKey(), base.displayOrder(), base.iconAssetId(),
                base.translations(), List.of(new Effect("SOURCE_SNAPSHOT", metadata)));
    }

    private static Map<String, Object> capture(String image, int hp, boolean review) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sourceImage", image);
        result.put("sourceHeroCode", image);
        result.put("rawAttributes", Map.of("basic", Map.of("health", Map.of("value", hp))));
        result.put("heroReviewFlags",
                List.of(Map.of("field", "hero.attributes", "status", review ? "reviewed" : "unresolved")));
        result.put("reviewFlags", List.of(Map.of("note", image)));
        result.put("review_flags", List.of(Map.of("note", image)));
        result.put("duplicateCaptures", List.of(Map.of("source_image", image)));
        result.put("completeness", review ? "CAPTURED_ONLY" : "NEEDS_REVIEW");
        result.put("cooldown", Map.of("seconds", 8, "display", "H.chiêu: 8s"));
        result.put("energyCost", Map.of("value", 10, "label", "N.lượng"));
        result.put("levelTable", levelTable("ST gốc", "280", review));
        result.put("tags", List.of("Vật lý"));
        return result;
    }

    private static Map<String, Object> levelTable(String label, String displayed, boolean review) {
        return Map.of("column_labels", List.of("Lv 1"), "rows", List.of(Map.of("label", label,
                "display_values", List.of(displayed), "values", List.of(280), "review_required", review,
                "reviewRequired", review)));
    }
}
