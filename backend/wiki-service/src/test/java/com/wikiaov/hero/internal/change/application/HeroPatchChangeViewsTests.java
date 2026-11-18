package com.wikiaov.hero.internal.change.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.wikiaov.hero.internal.change.persistence.HeroPatchChangeSetRepository.Header;
import com.wikiaov.hero.internal.change.persistence.HeroPatchHistory.Entry;
import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchAssessment;
import com.wikiaov.hero.internal.change.persistence.entity.MechanicChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.OtherChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.RoleChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.SkillChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.StatChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.VisualChangeClassification;
import com.wikiaov.hero.internal.domain.HeroChanges;
import com.wikiaov.hero.internal.domain.HeroChanges.ChangeSource;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class HeroPatchChangeViewsTests {
    @Test
    void keepsOverallAssessmentSeparateAndRendersOrderedLegacyFieldsWithNullableValues() {
        UUID hero = UUID.randomUUID();
        var header = mock(Header.class);
        when(header.getId()).thenReturn(UUID.randomUUID());
        when(header.getHeroId()).thenReturn(hero);
        when(header.getHeroCode()).thenReturn("airi");
        when(header.getSourceKind()).thenReturn(ChangeSource.PATCH_NOTES);
        when(header.getSourceUrl()).thenReturn("https://example.org/patch-notes");
        var assessment = new HeroPatchAssessment();
        assessment.setKind(HeroChanges.OverallKind.BUFF);
        assessment.setVersion(2);
        var stat = new StatChangeClassification();
        stat.setStatKey("HP");
        stat.setOldValue(new BigDecimal("3500"));
        stat.setNewValue(new BigDecimal("3400"));
        stat.setUnitCode("POINT");
        stat.setChangeKind("NERF");
        stat.setSortOrder(1);
        var skill = new SkillChangeClassification();
        skill.setSkillKey("skill-1-1");
        skill.setFieldKey("description");
        skill.setNewValue("New description");
        skill.setChangeKind("REWORK");
        skill.setSortOrder(0);
        var other = new OtherChangeClassification();
        other.setDescription("Other change");
        other.setSortOrder(2);
        var role = new RoleChangeClassification();
        role.setRoleCode("WARRIOR");
        role.setAdded(true);
        role.setSortOrder(3);
        var mechanic = new MechanicChangeClassification();
        mechanic.setMechanicKey("landing");
        mechanic.setDescription("Fixed landing");
        mechanic.setSortOrder(4);
        var visual = new VisualChangeClassification();
        visual.setMediaRole("HEAD");
        visual.setNewAssetId(UUID.randomUUID());
        visual.setSortOrder(5);

        var entry = new Entry(header, assessment, null, List.of(visual, role, stat, other, mechanic, skill), Map.of());
        JsonNode result = new JsonMapper().valueToTree(HeroPatchChangeViews.render(List.of(entry)).getFirst());

        assertThat(result.path("heroId").asText()).isEqualTo(hero.toString());
        assertThat(result.path("heroCode").asText()).isEqualTo("airi");
        assertThat(result.path("overallKind").asText()).isEqualTo("BUFF");
        assertThat(result.path("assessmentVersion").asLong()).isEqualTo(2L);
        assertThat(result.path("fromHeroRevisionId").isNull()).isTrue();
        assertThat(result.path("toHeroRevisionId").isNull()).isTrue();
        assertThat(result.path("sourceKind").asText()).isEqualTo("PATCH_NOTES");
        assertThat(result.path("sourceUrl").asText()).isEqualTo("https://example.org/patch-notes");
        assertThat(result.has("actualLocale")).isFalse();
        assertThat(result.has("summary")).isFalse();
        var facts = result.path("changes");
        assertThat(facts.valueStream().map(value -> value.path("type").asText())).containsExactly(
                "HERO_SKILL_CHANGE", "HERO_STAT_CHANGE", "HERO_OTHER_CHANGE", "HERO_ROLE_CHANGE",
                "HERO_MECHANIC_CHANGE", "HERO_VISUAL_CHANGE");
        assertThat(facts.get(0).path("oldValue").isNull()).isTrue();
        assertThat(facts.get(0).path("newValue").asText()).isEqualTo("New description");
        assertThat(facts.get(0).path("changeKind").asText()).isEqualTo("REWORK");
        assertThat(facts.get(0).path("skillKey").asText()).isEqualTo("skill-1-1");
        assertThat(facts.get(1).path("unitCode").asText()).isEqualTo("POINT");
        assertThat(facts.get(1).path("changeKind").asText()).isEqualTo("NERF");
        assertThat(facts.get(1).path("oldValue").decimalValue()).isEqualByComparingTo("3500");
        assertThat(facts.get(1).path("newValue").decimalValue()).isEqualByComparingTo("3400");
        assertThat(facts.get(1).has("unit") || facts.get(1).has("changeSetId")).isFalse();
        assertThat(facts.get(3).path("roleCode").asText()).isEqualTo("WARRIOR");
        assertThat(facts.get(3).path("added").asBoolean()).isTrue();
        assertThat(facts.get(4).path("mechanicKey").asText()).isEqualTo("landing");
        assertThat(facts.get(4).path("description").asText()).isEqualTo("Fixed landing");
        assertThat(facts.get(4).has("previous") && facts.get(4).path("previous").isNull()).isTrue();
        assertThat(facts.get(5).path("mediaRole").asText()).isEqualTo("HEAD");
        assertThat(facts.get(5).path("oldAssetId").isNull()).isTrue();
        assertThat(facts.get(5).path("newAssetId").asText()).isEqualTo(visual.getNewAssetId().toString());
    }
}
