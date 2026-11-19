package com.wikiaov.hero.internal.importing.application;

import com.wikiaov.hero.internal.alias.persistence.IdentifierAliases;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.HeroImportRequest;
import com.wikiaov.hero.internal.application.HeroImportRequest.Mode;
import com.wikiaov.hero.internal.application.response.HeroImportPlan;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.application.HeroAuthoring;
import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.authoring.persistence.HeroIdentityRepository;
import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.patch.AuthoringContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service
@PreAuthorize("hasAuthority('hero:write')")
public class HeroImports {
    private final HeroIdentityRepository heroes;
    private final HeroAuthoring authoring;
    private final GameplayContexts contexts;
    private final HeroImportContent content;
    private final HeroImportRevisions revisions;
    private final HeroImportWarnings warnings;
    private final HeroImportDraftWriter drafts;

    /**
     * A field an import file may fill. Admin names it from {@code key}; the server sends no display text.
     *
     * @param type how Admin reads the column: {@code text}, {@code number}, {@code json} or {@code image}
     */
    @Schema(name = "com.wikiaov.hero.internal.application.service.HeroImports.Field")
    public record Field(
            String key,
            String type
    ) {
    }

    public static final List<Field> FIELDS = List.of(
            new Field("name", "text"), new Field("title", "text"), new Field("summary", "text"),
            new Field("lore", "text"), new Field("roles", "json"), new Field("overviewRatings", "json"),
            new Field("combatStats", "json"), new Field("skills", "json"), new Field("skins", "json"),
            new Field("images", "json"), new Field("head", "image"), new Field("portrait", "image"),
            new Field("splash", "image"));

    public static final Map<String, List<Field>> RELATION_FIELDS = Map.of(
            "skills", List.of(new Field("skillKey", "text"), new Field("kind", "text"),
                    new Field("formKey", "text"), new Field("displayOrder", "number"), new Field("name", "text"),
                    new Field("description", "text"), new Field("effects", "json"),
                    new Field("iconAssetId", "image")),
            "skins", List.of(new Field("skinKey", "text"), new Field("displayOrder", "number"),
                    new Field("rarityCode", "text"), new Field("name", "text"), new Field("description", "text"),
                    new Field("acquisitionNote", "text"), new Field("artAssetId", "image"),
                    new Field("headAssetId", "image"), new Field("portraitAssetId", "image"),
                    new Field("images", "json")));

    public HeroImports(HeroIdentityRepository heroes, HeroAuthoring authoring, HeroValidation validation,
            GameplayContexts contexts, JsonMapper json, IdentifierAliases aliases) {
        this.heroes = heroes;
        this.authoring = authoring;
        this.contexts = contexts;
        this.content = new HeroImportContent(validation, json, aliases);
        this.revisions = new HeroImportRevisions(authoring, contexts);
        this.warnings = new HeroImportWarnings(json);
        this.drafts = new HeroImportDraftWriter(authoring, revisions, content, json);
    }

    /** The hero fields an import file may fill. */
    public List<Field> fields() {
        return FIELDS;
    }

    /** The fields of each repeated relation (skills, skins) an import file may fill. */
    public Map<String, List<Field>> relationFields() {
        return RELATION_FIELDS;
    }

    @Transactional(readOnly = true)
    public HeroImportPlan preview(HeroImportRequest input) {
        try {
            return plan(input);
        } catch (IllegalArgumentException | ClassCastException ex) {
            throw HeroValidation.invalid("An import value has an invalid type or format.");
        }
    }

    private HeroImportPlan plan(HeroImportRequest input) {
        var target = requireMatchingContext(input);
        requireSupportedFields(input);

        var hero = heroes.findByCode(input.code());
        var heroId = hero.map(h -> h.getId()).orElse(null);
        var revision = hero.map(h -> revisions.selectSnapshot(h.getId(), input, target)).orElse(null);
        var sections = revision == null
                ? Map.<HeroSection, Object>of()
                : authoring.preview(revision.heroId(), revision.id());

        var before = content.existingFields(sections, input.locale());
        var after = content.mergeAndNormalize(input, heroId, sections, before);
        var normalized = content.serializedFields(after);
        var original = content.serializedFields(before);

        boolean missing = revision == null && input.mode() != Mode.BASELINE;
        if (!missing) {
            content.validate(input.locale(), normalized, (Profile) sections.get(HeroSection.PROFILE));
        }

        boolean changed = !original.equals(normalized);

        return new HeroImportPlan(input.code(), heroId,
                revision == null ? null : revision.id(), revision == null ? null : revision.version(),
                original, normalized, changed,
                classification(input.mode(), hero.isEmpty(), revision, changed),
                !missing, revision == null ? null : revision.effectiveFromPatchVariantId(),
                warnings.forImport(input.mode(), original, normalized, revision, missing));
    }

    private AuthoringContext requireMatchingContext(HeroImportRequest input) {
        contexts.requireRuleset(input.rulesetId());
        var target = contexts.authoringContext(input.contextId());
        if (!target.rulesetId().equals(input.rulesetId())) {
            throw new ApiException(HeroErrorCode.HERO_IMPORT_CONTEXT_CONFLICT,
                    "The selected release belongs to a different ruleset.");
        }
        return target;
    }

    private void requireSupportedFields(HeroImportRequest input) {
        HeroValidation.locale(input.locale());
        var keys = FIELDS.stream().map(Field::key).toList();
        if (!keys.containsAll(input.values().keySet()) || !keys.containsAll(input.policies().keySet())) {
            throw HeroValidation.invalid("Unknown import field.");
        }
    }

    private static String classification(Mode mode, boolean newHero, HeroRevisionView revision, boolean changed) {
        if (revision == null && mode != Mode.BASELINE) {
            return "INSUFFICIENT_DATA";
        }
        if (newHero) {
            return "NEW_TO_CATALOG";
        }
        if (mode == Mode.BASELINE && revision == null) {
            return "BASELINE";
        }
        return changed ? "CHANGED" : "UNCHANGED";
    }

    @Transactional(readOnly = true)
    public List<AuthoringContext> contexts(UUID regionId, UUID seasonId) {
        return contexts.authoring(regionId, seasonId);
    }

    @Transactional
    public HeroImportPlan apply(HeroImportRequest input) {
        lockExistingHero(input.code());
        var plan = preview(input);
        requireApplicableCurrentPreview(input, plan);
        if (!plan.changed()) {
            return plan;
        }

        drafts.apply(input, plan);

        return preview(input);
    }

    private void lockExistingHero(String code) {
        heroes.findByCode(code).ifPresent(h -> heroes.lockById(h.getId()));
    }

    private void requireApplicableCurrentPreview(HeroImportRequest input, HeroImportPlan plan) {
        if (!plan.canApply()) {
            throw new ApiException(HeroErrorCode.HERO_IMPORT_MISSING_BASELINE,
                    "No known snapshot is available for this import mode.");
        }
        if (!Objects.equals(plan.revisionId(), input.expectedRevisionId())
                || !Objects.equals(plan.version(), input.expectedVersion())) {
            throw new ApiException(HeroErrorCode.HERO_REVISION_VERSION_CONFLICT,
                    "The import preview is stale. Preview the row again.");
        }
    }
}
