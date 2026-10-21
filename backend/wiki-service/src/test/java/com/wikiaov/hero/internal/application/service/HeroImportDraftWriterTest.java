package com.wikiaov.hero.internal.application.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.wikiaov.hero.internal.application.HeroImportRequest;
import com.wikiaov.hero.internal.application.HeroImportRequest.Mode;
import com.wikiaov.hero.internal.application.response.HeroImportPlan;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.persistence.IdentifierAliases;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.json.JsonMapper;

class HeroImportDraftWriterTest {
    private final HeroAuthoring authoring = mock(HeroAuthoring.class);
    private final HeroImportRevisions revisions = mock(HeroImportRevisions.class);
    private final JsonMapper json = new JsonMapper();
    private final HeroImportContent content = new HeroImportContent(mock(HeroValidation.class), json,
            mock(IdentifierAliases.class));
    private final HeroImportDraftWriter writer = new HeroImportDraftWriter(authoring, revisions, content, json);
    private final UUID heroId = UUID.randomUUID();
    private final UUID revisionId = UUID.randomUUID();
    private final UUID rulesetId = UUID.randomUUID();
    private final Source source = new Source("Verified source", null, null, Verification.VERIFIED, null);

    @Test
    void sectionWritesPreserveSourcesAndTranslationsAndCarryVersionsBeforeRereadingMedia() {
        var english = new ProfileTranslation("en-US", "Airi", "Original", null, null);
        var existing = Map.<HeroSection, Object>of(
                HeroSection.PROFILE, new Profile(List.of(english,
                        new ProfileTranslation("vi-VN", "Old name", null, null, null)), Set.of(Role.ASSASSIN),
                        List.of(source)),
                HeroSection.SKILLS, new Skills(List.of(skill("Old skill")), List.of(source)),
                HeroSection.SKINS, new Skins(List.of(skin("Old skin")), List.of(source)),
                HeroSection.MEDIA_BINDINGS, new Bindings(Map.of(), List.of(source)));
        var before = content.serializedFields(content.existingFields(existing, "vi-VN"));
        Map<String, Object> after = new LinkedHashMap<>(before);
        after.put("name", "New name");
        after.put("combatStats", new Stats(List.of(new Stat("HP", BigDecimal.TEN, null, "POINT")), List.of()));
        after.put("skills", List.of(skill("New skill")));
        after.put("skins", List.of(skin("New skin")));
        var image = UUID.randomUUID();
        after.put("head", image.toString());
        var plan = plan(before, content.serializedFields(after));
        var request = new HeroImportRequest("airi", rulesetId, UUID.randomUUID(), Mode.CORRECTION, "vi-VN",
                Map.of(), Map.of(), revisionId, 7L);
        when(revisions.openDraft(request, plan)).thenReturn(revision(7));
        when(authoring.preview(heroId, revisionId)).thenReturn(existing);
        when(authoring.update(eq(heroId), eq(revisionId), any(), anyLong(), any(), any()))
                .thenAnswer(call -> revision(call.<Long>getArgument(3) + 1));
        when(authoring.read(heroId, revisionId)).thenReturn(revision(99));

        writer.apply(request, plan);

        var profile = ArgumentCaptor.forClass(Profile.class);
        var skills = ArgumentCaptor.forClass(Skills.class);
        var skins = ArgumentCaptor.forClass(Skins.class);
        var bindings = ArgumentCaptor.forClass(Bindings.class);
        var order = inOrder(authoring);
        order.verify(authoring).preview(heroId, revisionId);
        order.verify(authoring).update(eq(heroId), eq(revisionId), eq(HeroSection.PROFILE), eq(7L), profile.capture(),
                eq("Imported hero fields"));
        order.verify(authoring).update(eq(heroId), eq(revisionId), eq(HeroSection.COMBAT_STATS), eq(8L),
                any(Stats.class),
                eq("Imported hero statistics"));
        order.verify(authoring).update(eq(heroId), eq(revisionId), eq(HeroSection.SKILLS), eq(9L), skills.capture(),
                eq("Imported skills"));
        order.verify(authoring).update(eq(heroId), eq(revisionId), eq(HeroSection.SKINS), eq(10L), skins.capture(),
                eq("Imported skins"));
        order.verify(authoring).read(heroId, revisionId);
        order.verify(authoring).update(eq(heroId), eq(revisionId), eq(HeroSection.MEDIA_BINDINGS), eq(99L),
                bindings.capture(), eq("Imported hero images"));
        order.verifyNoMoreInteractions();
        assertThat(profile.getValue().translations()).containsExactly(english,
                new ProfileTranslation("vi-VN", "New name", null, null, null));
        assertThat(profile.getValue().sources()).containsExactly(source);
        assertThat(skills.getValue().sources()).containsExactly(source);
        assertThat(skins.getValue().sources()).containsExactly(source);
        assertThat(bindings.getValue().sources()).containsExactly(source);
        assertThat(bindings.getValue().bindings()).containsExactlyEntriesOf(Map.of(MediaRole.HEAD, image));
    }

    @Test
    void unchangedSectionsDoNotWriteOrRefreshMedia() {
        var existing = Map.<HeroSection, Object>of(HeroSection.PROFILE,
                new Profile(List.of(new ProfileTranslation("vi-VN", "Airi", null, null, null)),
                        Set.of(Role.ASSASSIN), List.of()));
        var fields = content.serializedFields(content.existingFields(existing, "vi-VN"));
        var plan = plan(fields, fields);
        var request = new HeroImportRequest("airi", rulesetId, UUID.randomUUID(), Mode.CORRECTION, "vi-VN",
                Map.of(), Map.of(), revisionId, 7L);
        when(revisions.openDraft(request, plan)).thenReturn(revision(7));
        when(authoring.preview(heroId, revisionId)).thenReturn(existing);

        writer.apply(request, plan);

        verify(authoring).preview(heroId, revisionId);
        verifyNoMoreInteractions(authoring);
    }

    private HeroImportPlan plan(Map<String, Object> before, Map<String, Object> after) {
        return new HeroImportPlan("airi", heroId, revisionId, 7L, before, after, true, "CHANGED", true,
                UUID.randomUUID(), List.of());
    }

    private HeroRevisionView revision(long version) {
        return new HeroRevisionView(revisionId, heroId, rulesetId, 1L, "DRAFT", version, null, null,
                Cause.IMPORT_CORRECTION, null, UUID.randomUUID(), Map.of());
    }

    private Skill skill(String description) {
        return new Skill("skill-1", SkillKind.ACTIVE, null, 0, null,
                List.of(new SkillTranslation("vi-VN", "Skill", description)), List.of());
    }

    private Skin skin(String name) {
        return new Skin("airi-original-1", 0, null, null, List.of(new SkinTranslation("vi-VN", name, null, null)));
    }
}
