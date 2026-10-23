package com.wikiaov.patch.internal.ruleset.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.patch.internal.application.PatchCommands.*;
import com.wikiaov.patch.internal.application.PatchCommands.Assignment;
import com.wikiaov.patch.internal.application.PatchCommands.CreateRegion;
import com.wikiaov.patch.internal.application.PatchCommands.Ruleset;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.ruleset.persistence.GameplayRulesetRepository;
import com.wikiaov.patch.internal.ruleset.persistence.RegionRepository;
import com.wikiaov.patch.internal.ruleset.persistence.RulesetAssignmentRepository;
import com.wikiaov.patch.internal.ruleset.persistence.entity.GameplayRuleset;
import com.wikiaov.patch.internal.ruleset.persistence.entity.Region;
import com.wikiaov.patch.internal.ruleset.persistence.entity.RulesetAssignment;
import com.wikiaov.platform.ApiException;
import java.time.Clock;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

@Component
public class RulesetAdministration {
    private final RegionRepository regions;
    private final GameplayRulesetRepository rulesets;
    private final RulesetAssignmentRepository assignments;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;

    public RulesetAdministration(RegionRepository regions, GameplayRulesetRepository rulesets,
            RulesetAssignmentRepository assignments, CurrentActor actors, AuditLog audit, Clock clock) {
        this.regions = regions;
        this.rulesets = rulesets;
        this.assignments = assignments;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }

    public UUID region(CreateRegion input) {
        try {
            java.time.ZoneId.of(input.timezone());
            new java.util.Locale.Builder().setLanguageTag(input.defaultLocale()).build();
        } catch (java.time.DateTimeException | java.util.IllformedLocaleException exception) {
            throw invalid("The region locale or time zone is invalid.");
        }
        UUID id = UUID.randomUUID();
        persist(() -> regions.saveAndFlush(new Region(id, input.code(), input.displayName(), input.productName(),
                input.defaultLocale(), input.timezone(), input.available())));
        audit.record(AuditEntry.of(actors.require(), "REGION_CREATED", "REGION", id));
        return id;
    }

    public UUID ruleset(Ruleset input) {
        UUID id = UUID.randomUUID();
        var entity = new GameplayRuleset();
        entity.setId(id);
        entity.setCode(input.code());
        entity.setDescription(input.description());
        entity.setLifecycleState("ACTIVE");
        entity.setCreatedAt(clock.instant());
        persist(() -> rulesets.saveAndFlush(entity));
        record("RULESET_CREATED", id);
        return id;
    }

    public UUID assign(UUID regionId, Assignment input) {
        if (input.validTo() != null && !input.validTo().isAfter(input.validFrom()))
            throw invalid("Assignment end must follow its start.");
        regions.lockById(regionId).orElseThrow(RulesetAdministration::notFound);
        rulesets.lockById(input.rulesetId()).orElseThrow(RulesetAdministration::notFound);
        UUID id = UUID.randomUUID();
        var entity = new RulesetAssignment();
        entity.setId(id);
        entity.setRegionId(regionId);
        entity.setRulesetId(input.rulesetId());
        entity.setValidFrom(input.validFrom());
        entity.setValidTo(input.validTo());
        persist(() -> assignments.saveAndFlush(entity));
        record("REGION_RULESET_ASSIGNED", id);
        return id;
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
