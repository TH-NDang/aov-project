package com.wikiaov.hero.internal.change.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.wikiaov.hero.internal.change.persistence.HeroPatchChangeSetRepository.Header;
import com.wikiaov.hero.internal.change.persistence.HeroPatchHistory.Entry;
import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchAssessment;
import com.wikiaov.hero.internal.change.persistence.entity.MechanicChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.OtherChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.RoleChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.SkillChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.StatChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.VisualChangeClassification;
import com.wikiaov.hero.internal.domain.HeroChanges.*;
import com.wikiaov.hero.internal.domain.HeroChanges.Kind;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class HeroPatchChangeViewsTests {
    @Test
    @SuppressWarnings("unchecked")
    void keepsOverallAssessmentSeparateAndRendersOrderedLegacyFieldsWithNullableValues() {
        UUID hero = UUID.randomUUID();
        var header = mock(Header.class);
        when(header.getId()).thenReturn(UUID.randomUUID());
        when(header.getHeroId()).thenReturn(hero);
        when(header.getHeroCode()).thenReturn("airi");
        when(header.getSourceKind()).thenReturn(ChangeSource.PATCH_NOTES);
        when(header.getSourceUrl()).thenReturn("https://example.org/patch-notes");
        var assessment = new HeroPatchAssessment();
        assessment.setKind(Kind.BUFF);
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

        var entry = new Entry(header, assessment, null, List.of(visual, role, stat, other, mechanic, skill));
        var result = HeroPatchChangeViews.render(List.of(entry)).getFirst();

        assertThat(result).containsEntry("heroId", hero).containsEntry("heroCode", "airi")
                .containsEntry("overallKind", "BUFF").containsEntry("assessmentVersion", 2L)
                .containsEntry("fromHeroRevisionId", null).containsEntry("toHeroRevisionId", null)
                .containsEntry("sourceKind", "PATCH_NOTES")
                .containsEntry("sourceUrl", "https://example.org/patch-notes")
                .doesNotContainKeys("actualLocale", "summary");
        var facts = (List<Map<String, Object>>) result.get("changes");
        assertThat(facts).extracting(value -> value.get("type")).containsExactly("HERO_SKILL_CHANGE",
                "HERO_STAT_CHANGE", "HERO_OTHER_CHANGE", "HERO_ROLE_CHANGE", "HERO_MECHANIC_CHANGE",
                "HERO_VISUAL_CHANGE");
        assertThat(facts.getFirst()).containsEntry("oldValue", null).containsEntry("newValue", "New description")
                .containsEntry("changeKind", "REWORK").containsEntry("skillKey", "skill-1-1");
        assertThat(facts.get(1)).containsEntry("unitCode", "POINT").containsEntry("changeKind", "NERF")
                .containsEntry("oldValue", new BigDecimal("3500")).containsEntry("newValue", new BigDecimal("3400"))
                .doesNotContainKeys("unit", "changeSetId");
        assertThat(facts.get(3)).containsEntry("roleCode", "WARRIOR").containsEntry("added", true);
        assertThat(facts.get(4)).containsEntry("mechanicKey", "landing").containsEntry("description", "Fixed landing");
        assertThat(facts.get(5)).containsEntry("mediaRole", "HEAD").containsEntry("oldAssetId", null)
                .containsEntry("newAssetId", visual.getNewAssetId());
    }
}
