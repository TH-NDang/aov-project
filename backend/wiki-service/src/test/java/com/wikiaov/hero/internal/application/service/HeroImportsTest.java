package com.wikiaov.hero.internal.application.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.HeroImportRequest;
import com.wikiaov.hero.internal.application.HeroImportRequest.Mode;
import com.wikiaov.hero.internal.application.HeroImportRequest.Policy;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.persistence.HeroIdentityRepository;
import com.wikiaov.hero.internal.persistence.IdentifierAliases;
import com.wikiaov.hero.internal.persistence.entity.HeroIdentity;
import com.wikiaov.patch.AuthoringContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.exc.MismatchedInputException;
import tools.jackson.databind.json.JsonMapper;

class HeroImportsTest {
    private final HeroIdentityRepository heroes = mock(HeroIdentityRepository.class);
    private final HeroAuthoring authoring = mock(HeroAuthoring.class);
    private final HeroValidation validation = mock(HeroValidation.class);
    private final GameplayContexts contexts = mock(GameplayContexts.class);
    private final IdentifierAliases aliases = mock(IdentifierAliases.class);
    private final JsonMapper json = new JsonMapper();
    private final HeroImports imports = new HeroImports(heroes, authoring, validation, contexts, json, aliases);
    private final UUID heroId = UUID.randomUUID();
    private final UUID rulesetId = UUID.randomUUID();
    private final UUID contextId = UUID.randomUUID();
    private final UUID patchId = UUID.randomUUID();
    private final UUID revisionId = UUID.randomUUID();
    private final Map<HeroSection, Object> sections = new EnumMap<>(HeroSection.class);

    @BeforeEach
    void existingDraft() {
        var hero = new HeroIdentity();
        hero.setId(heroId);
        hero.setCode("airi");
        when(heroes.findByCode("airi")).thenReturn(Optional.of(hero));
        when(contexts.authoringContext(contextId)).thenReturn(new AuthoringContext(contextId, null, "VN", null,
                null, rulesetId, patchId, "2026-10", 10L, null));
        when(authoring.revisions(heroId)).thenReturn(List.of(revision("DRAFT", Cause.IMPORT_CORRECTION, patchId)));
        when(authoring.preview(heroId, revisionId)).thenReturn(sections);
        when(aliases.skins(any(), any())).thenAnswer(call -> call.getArgument(1));
        sections.put(HeroSection.PROFILE, new Profile(
                List.of(new ProfileTranslation("vi-VN", "Airi", null, "Original summary", "Original lore")),
                Set.of(Role.ASSASSIN), List.of()));
        sections.put(HeroSection.SKILLS, new Skills(List.of(), List.of()));
        sections.put(HeroSection.SKINS, new Skins(List.of(), List.of()));
        sections.put(HeroSection.MEDIA_BINDINGS, new Bindings(Map.of(), List.of()));
    }

    @Test
    void fieldPoliciesDoNotEraseExistingValuesAndDefaultToFillingOnlyEmptyFields() {
        var result = imports.preview(request(Mode.CORRECTION,
                Map.of("name", "Ignored name", "title", "New title", "summary", "New summary", "lore", "Skipped",
                        "roles", List.of()),
                Map.of("summary", Policy.OVERWRITE, "lore", Policy.SKIP, "roles", Policy.OVERWRITE), revisionId, 7L));

        assertThat(result.after()).containsEntry("name", "Airi").containsEntry("title", "New title")
                .containsEntry("summary", "New summary").containsEntry("lore", "Original lore")
                .containsEntry("roles", List.of("ASSASSIN"));
        assertThat(result.before()).containsEntry("title", null).containsEntry("summary", "Original summary");
        assertThat(result.classification()).isEqualTo("CHANGED");
    }

    @Test
    void normalizingJsonCollectionsAndStatOrderKeepsRepeatedImportsUnchanged() {
        var armor = new Stat("ARMOR", BigDecimal.TEN, null, "POINT");
        var health = new Stat("HP", new BigDecimal("3500"), null, "POINT");
        sections.put(HeroSection.COMBAT_STATS, new Stats(List.of(armor, health), List.of()));
        var result = imports.preview(request(Mode.CORRECTION,
                Map.of("roles", List.of("ASSASSIN"), "combatStats", new Stats(List.of(health, armor), List.of())),
                Map.of("combatStats", Policy.OVERWRITE), revisionId, 7L));

        assertThat(result.changed()).isFalse();
        assertThat(result.classification()).isEqualTo("UNCHANGED");
        assertThat(result.after()).isEqualTo(result.before());
    }

    @Test
    void skinAliasesResolveBeforeRetainingPreviousMainArtwork() {
        var previousImage = UUID.randomUUID();
        var incomingImage = UUID.randomUUID();
        var previous = skin("airi-original-1", previousImage);
        var imported = skin("legacy-key", incomingImage);
        var canonical = skin("airi-original-1", incomingImage);
        sections.put(HeroSection.SKINS, new Skins(List.of(previous), List.of()));
        when(aliases.skins(eq(heroId), any())).thenReturn(new Skins(List.of(canonical), List.of()));

        var result = imports.preview(request(Mode.CORRECTION, Map.of("skins", List.of(imported)),
                Map.of("skins", Policy.OVERWRITE), revisionId, 7L));
        var skin = json.convertValue(result.after().get("skins"), Skin[].class)[0];

        assertThat(skin.skinKey()).isEqualTo("airi-original-1");
        assertThat(skin.artAssetId()).isEqualTo(incomingImage);
        assertThat(skin.images().get(MediaRole.SPLASH)).containsExactly(new ImageOption(previousImage, null));
        var order = inOrder(validation, aliases);
        order.verify(validation).validate(HeroSection.SKINS, new Skins(List.of(imported), List.of()));
        order.verify(aliases).skins(heroId, new Skins(List.of(imported), List.of()));
        order.verify(validation).validate(HeroSection.SKINS, new Skins(List.of(canonical), List.of()));
    }

    @Test
    void changingHeroMainImageRetainsCollectedAlternatives() {
        var oldMain = UUID.randomUUID();
        var newMain = UUID.randomUUID();
        var alternative = new ImageOption(UUID.randomUUID(), "Collected");
        sections.put(HeroSection.MEDIA_BINDINGS,
                new Bindings(Map.of(MediaRole.HEAD, oldMain), List.of(), Map.of(MediaRole.HEAD, List.of(alternative))));

        var result = imports.preview(request(Mode.CORRECTION, Map.of("head", newMain.toString()),
                Map.of("head", Policy.OVERWRITE), revisionId, 7L));
        var content = new HeroImportContent(validation, json, aliases);

        assertThat(result.after()).containsEntry("head", newMain.toString());
        assertThat(content.imageOptions(result.after().get("images")).get(MediaRole.HEAD))
                .containsExactly(alternative, new ImageOption(oldMain, null));
    }

    @Test
    void missingBaselineSkipsCompleteProfileValidationButKeepsWarningOrder() {
        when(authoring.revisions(heroId)).thenReturn(List.of());
        var skill = new Skill("skill-1", SkillKind.ACTIVE, null, 0, null,
                List.of(new SkillTranslation("vi-VN", "Skill", "")),
                List.of(new Effect("SOURCE_SNAPSHOT", Map.of("review_flags", List.of("missing-description")))));

        var result = imports
                .preview(request(Mode.PATCH_UPDATE, Map.of("skills", List.of(skill)), Map.of(), null, null));

        assertThat(result.canApply()).isFalse();
        assertThat(result.classification()).isEqualTo("INSUFFICIENT_DATA");
        assertThat(result.warnings()).containsExactly(
                "Cần bổ sung trước khi xuất bản: vai trò tướng.",
                "Cần bổ sung trước khi xuất bản: mô tả kỹ năng skill-1 (vi-VN).",
                "Cần kiểm tra nguồn kỹ năng skill-1: dữ liệu thu thập còn cảnh báo; không tự suy đoán nội dung bị thiếu.",
                "Chưa có mốc trước patch này để so sánh. Hãy nhập dữ liệu ban đầu; không suy ngược từ tương lai.");
        verify(validation, never()).validate(eq(HeroSection.PROFILE), any());
        verify(validation).validate(eq(HeroSection.SKINS), any());
    }

    @Test
    void invalidCollectionTypesPreserveJacksonConversionFailure() {
        assertThatThrownBy(() -> imports.preview(request(Mode.CORRECTION, Map.of("roles", 42),
                Map.of("roles", Policy.OVERWRITE), revisionId, 7L)))
                .isExactlyInstanceOf(MismatchedInputException.class)
                .isInstanceOfSatisfying(MismatchedInputException.class, error -> {
                    assertThat(error.getTargetType()).isEqualTo(Role[].class);
                    assertThat(error.getCurrentToken()).isEqualTo(JsonToken.VALUE_NUMBER_INT);
                });
        verifyNoInteractions(validation, aliases);
        verify(authoring).revisions(heroId);
        verify(authoring).preview(heroId, revisionId);
        verifyNoMoreInteractions(authoring);
    }

    @Test
    void invalidImageIdentifiersKeepThePublicImportError() {
        assertError(() -> imports.preview(request(Mode.CORRECTION, Map.of("head", "not-a-uuid"),
                Map.of("head", Policy.OVERWRITE), revisionId, 7L)),
                HeroErrorCode.HERO_INVALID_CONTENT, "An import value has an invalid type or format.");
    }

    @Test
    void ignoredInvalidValuesAreNotConvertedWhenFillEmptyRetainsExistingContent() {
        var result = imports.preview(request(Mode.CORRECTION, Map.of("roles", 42), Map.of(), revisionId, 7L));

        assertThat(result.after()).containsEntry("roles", List.of("ASSASSIN"));
        assertThat(result.changed()).isFalse();
    }

    @Test
    void applyLocksBeforePreviewAndRejectsStaleUnchangedRows() {
        assertError(() -> imports.apply(request(Mode.CORRECTION, Map.of(), Map.of(), revisionId, 6L)),
                HeroErrorCode.HERO_REVISION_VERSION_CONFLICT, "The import preview is stale. Preview the row again.");

        var order = inOrder(heroes, contexts);
        order.verify(heroes).findByCode("airi");
        order.verify(heroes).lockById(heroId);
        order.verify(contexts).requireRuleset(rulesetId);
        verify(authoring, never()).read(any(), any());
        verify(authoring, never()).update(any(), any(), any(), anyLong(), any(), any());
    }

    @Test
    void missingBaselineWinsOverStalePreviewConflict() {
        when(authoring.revisions(heroId)).thenReturn(List.of());
        assertError(() -> imports.apply(request(Mode.PATCH_UPDATE, Map.of(), Map.of(), revisionId, 7L)),
                HeroErrorCode.HERO_IMPORT_MISSING_BASELINE, "No known snapshot is available for this import mode.");
        verify(authoring, never()).create(any());
    }

    @Test
    void currentUnchangedPreviewDoesNotWriteOrReopenTheDraft() {
        var result = imports.apply(request(Mode.CORRECTION, Map.of(), Map.of(), revisionId, 7L));

        assertThat(result.changed()).isFalse();
        verify(authoring, times(1)).preview(heroId, revisionId);
        verify(authoring, never()).read(any(), any());
        verify(authoring, never()).update(any(), any(), any(), anyLong(), any(), any());
    }

    @Test
    void anExistingSnapshotRequiresCorrectionRatherThanBaselineImport() {
        when(authoring.revisions(heroId)).thenReturn(List.of(revision("PUBLISHED", Cause.DATA_BASELINE, patchId)));
        assertError(() -> imports.preview(request(Mode.BASELINE, Map.of(), Map.of(), null, null)),
                HeroErrorCode.HERO_IMPORT_SNAPSHOT_EXISTS,
                "This patch already has a snapshot. Choose correction mode.");
        verify(authoring, never()).preview(any(), any());
    }

    @Test
    void anUnrelatedDraftIsRejectedBeforeReadingItsSections() {
        when(authoring.revisions(heroId))
                .thenReturn(List.of(revision("DRAFT", Cause.IMPORT_CORRECTION, UUID.randomUUID())));
        assertError(() -> imports.preview(request(Mode.CORRECTION, Map.of(), Map.of(), revisionId, 7L)),
                HeroErrorCode.HERO_IMPORT_DRAFT_CONFLICT,
                "Another draft exists. Finish or discard it before changing patch or import mode.");
        verify(authoring, never()).preview(any(), any());
    }

    private HeroImportRequest request(Mode mode, Map<String, Object> values, Map<String, Policy> policies,
            UUID expectedId, Long expectedVersion) {
        return new HeroImportRequest("airi", rulesetId, contextId, mode, "vi-VN", values, policies,
                expectedId, expectedVersion);
    }

    private HeroRevisionView revision(String state, Cause cause, UUID patch) {
        return new HeroRevisionView(revisionId, heroId, rulesetId, 1L, state, 7L, 1L, null, cause, null, patch,
                Map.of());
    }

    private Skin skin(String key, UUID artwork) {
        return new Skin(key, 0, artwork, null,
                List.of(new SkinTranslation("vi-VN", "Original", null, null)));
    }

    private void assertError(Runnable action, HeroErrorCode code, String detail) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ApiException.class, error -> {
            assertThat(error.getErrorCode()).isEqualTo(code);
            assertThat(error.getMessage()).isEqualTo(detail);
        });
    }
}
