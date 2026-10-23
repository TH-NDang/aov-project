package com.wikiaov.patch.internal.authoring.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.patch.internal.application.PatchCommands.*;
import com.wikiaov.patch.internal.application.PatchCommands.Patch;
import com.wikiaov.patch.internal.application.PatchCommands.SeasonPatch;
import com.wikiaov.patch.internal.application.PatchCommands.Variant;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.authoring.persistence.GamePatchRepository;
import com.wikiaov.patch.internal.authoring.persistence.GamePatchTranslationRepository;
import com.wikiaov.patch.internal.authoring.persistence.PatchVariantRepository;
import com.wikiaov.patch.internal.authoring.persistence.entity.GamePatch;
import com.wikiaov.patch.internal.authoring.persistence.entity.GamePatchTranslation;
import com.wikiaov.patch.internal.authoring.persistence.entity.PatchVariant;
import com.wikiaov.patch.internal.ruleset.persistence.GameplayRulesetRepository;
import com.wikiaov.platform.ApiException;
import java.time.Clock;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

@Component
public class PatchDrafts {
    private final GameplayRulesetRepository rulesets;
    private final GamePatchRepository patches;
    private final GamePatchTranslationRepository translations;
    private final PatchVariantRepository variants;
    private final SeasonPatchPlacement seasonPlacement;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;

    public PatchDrafts(GameplayRulesetRepository rulesets, GamePatchRepository patches,
            GamePatchTranslationRepository translations, PatchVariantRepository variants,
            SeasonPatchPlacement seasonPlacement, CurrentActor actors, AuditLog audit, Clock clock) {
        this.rulesets = rulesets;
        this.patches = patches;
        this.translations = translations;
        this.variants = variants;
        this.seasonPlacement = seasonPlacement;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }

    public UUID patch(Patch input) {
        UUID id = UUID.randomUUID();
        var actor = actors.require();
        var entity = new GamePatch();
        entity.setId(id);
        entity.setCode(input.code());
        entity.setStatus("DRAFT");
        entity.setCreatedAt(clock.instant());
        entity.setCreatedByIssuer(actor.issuer());
        entity.setCreatedBySubject(actor.subject());
        persist(() -> patches.saveAndFlush(entity));
        for (var text : input.translations())
            persist(() -> translations.saveAndFlush(new GamePatchTranslation(id, text.locale(), text.title(),
                    text.summary(), text.description())));
        record("PATCH_CREATED", id);
        return id;
    }

    public UUID variant(UUID patchId, Variant input) {
        rulesets.lockById(input.rulesetId()).orElseThrow(PatchDrafts::notFound);
        patches.lockById(patchId).orElseThrow(PatchDrafts::notFound);
        long ordinal = input.rulesetOrdinal();
        if (input.beforeVariantId() != null) {
            var anchor = variants.lockById(input.beforeVariantId()).orElseThrow(PatchDrafts::notFound);
            if (!anchor.getRulesetId().equals(input.rulesetId()))
                throw invalid("The insertion anchor must belong to the same ruleset.");
            ordinal = anchor.getRulesetOrdinal();
            variants.makeOrdinalSpace(input.rulesetId(), ordinal);
        }
        var entity = new PatchVariant();
        entity.setId(UUID.randomUUID());
        entity.setPatchId(patchId);
        entity.setRulesetId(input.rulesetId());
        entity.setVariantCode(input.variantCode());
        entity.setRulesetOrdinal(ordinal);
        entity.setStatus("DRAFT");
        entity.setCreatedAt(clock.instant());
        persist(() -> variants.saveAndFlush(entity));
        record("PATCH_VARIANT_CREATED", entity.getId());
        return entity.getId();
    }

    public UUID seasonPatch(SeasonPatch input) {
        var placement = seasonPlacement.choosePlacement(input);
        UUID patchId = patch(input.patch());
        UUID variantId = variant(patchId, new Variant(input.rulesetId(), input.patch().code(),
                placement.appendOrdinal(), placement.beforeVariantId()));
        variants.lockById(variantId).orElseThrow(PatchDrafts::notFound).setSeasonId(input.seasonId());
        return variantId;
    }

    public void publish(UUID variantId) {
        var snapshot = variants.snapshotById(variantId).orElseThrow(PatchDrafts::notFound);
        rulesets.lockById(snapshot.getRulesetId()).orElseThrow(PatchDrafts::notFound);
        var variant = variants.lockById(variantId).orElseThrow(PatchDrafts::notFound);
        if ("PUBLISHED".equals(variant.getStatus()))
            return;
        variant.setStatus("PUBLISHED");
        variant.setPublishedAt(clock.instant());
        patches.lockById(variant.getPatchId()).orElseThrow(PatchDrafts::notFound).setStatus("PUBLISHED");
        record("PATCH_VARIANT_PUBLISHED", variantId);
    }

    private void record(String action, UUID id) {
        audit.record(AuditEntry.of(actors.require(), action, "PATCH", id));
    }

    private static void persist(Supplier<?> operation) {
        try {
            operation.get();
        } catch (DataIntegrityViolationException exception) {
            throw new ApiException(PatchErrorCode.PATCH_CONFLICT, "The patch operation conflicts with existing data.");
        }
    }

    private static ApiException invalid(String detail) {
        return new ApiException(PatchErrorCode.PATCH_INVALID, detail);
    }

    private static ApiException notFound() {
        return new ApiException(PatchErrorCode.PATCH_NOT_FOUND, "Patch resource does not exist.");
    }
}
