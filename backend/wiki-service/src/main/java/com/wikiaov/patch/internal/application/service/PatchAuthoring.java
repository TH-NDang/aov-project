package com.wikiaov.patch.internal.application.service;

import com.wikiaov.access.*;
import com.wikiaov.patch.internal.application.PatchCommands.*;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.persistence.PatchStore;
import com.wikiaov.patch.internal.persistence.entity.*;
import com.wikiaov.platform.ApiException;
import java.sql.Timestamp;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PatchAuthoring {
    private final PatchStore store;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;
    private final RankedSeasons seasons;
    public PatchAuthoring(PatchStore store, CurrentActor actors, AuditLog audit, Clock clock, RankedSeasons seasons) {
        this.store = store;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
        this.seasons = seasons;
    }

    @PreAuthorize("hasAuthority('region:admin')")
    public UUID region(CreateRegion input) {
        try {
            java.time.ZoneId.of(input.timezone());
            new java.util.Locale.Builder().setLanguageTag(input.defaultLocale()).build();
        } catch (java.time.DateTimeException | java.util.IllformedLocaleException exception) {
            throw invalid("The region locale or time zone is invalid.");
        }
        UUID id = UUID.randomUUID();
        insert(new Region(id, input.code(), input.displayName(), input.productName(), input.defaultLocale(),
                input.timezone(), input.available()));
        audit.record(AuditEntry.of(actors.require(), "REGION_CREATED", "REGION", id));
        return id;
    }

    @PreAuthorize("hasAuthority('region:admin')")
    public UUID ruleset(Ruleset input) {
        UUID id = UUID.randomUUID();
        var entity = new GameplayRuleset();
        entity.setId(id);
        entity.setCode(input.code());
        entity.setDescription(input.description());
        entity.setLifecycleState("ACTIVE");
        entity.setCreatedAt(clock.instant());
        insert(entity);
        record("RULESET_CREATED", id);
        return id;
    }

    @PreAuthorize("hasAuthority('region:admin')")
    public UUID assign(UUID regionId, Assignment input) {
        if (input.validTo() != null && !input.validTo().isAfter(input.validFrom()))
            throw invalid("Assignment end must follow its start.");
        store.one("SELECT id FROM patch.region WHERE id=? FOR UPDATE", regionId);
        store.lockRuleset(input.rulesetId());
        UUID id = UUID.randomUUID();
        var entity = new RulesetAssignment();
        entity.setId(id);
        entity.setRegionId(regionId);
        entity.setRulesetId(input.rulesetId());
        entity.setValidFrom(input.validFrom());
        entity.setValidTo(input.validTo());
        insert(entity);
        record("REGION_RULESET_ASSIGNED", id);
        return id;
    }

    @PreAuthorize("hasAuthority('patch:write')")
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
        insert(entity);
        for (var t : input.translations())
            write("INSERT INTO patch.game_patch_translation VALUES(?,?,?,?,?)", id, t.locale(), t.title(), t.summary(),
                    t.description());
        record("PATCH_CREATED", id);
        return id;
    }

    @PreAuthorize("hasAuthority('patch:write')")
    public UUID variant(UUID patchId, Variant input) {
        store.lockRuleset(input.rulesetId());
        store.lock(GamePatch.class, patchId);
        long ordinal = input.rulesetOrdinal();
        if (input.beforeVariantId() != null) {
            var anchor = store.lock(PatchVariant.class, input.beforeVariantId());
            if (!anchor.getRulesetId().equals(input.rulesetId()))
                throw invalid("The insertion anchor must belong to the same ruleset.");
            ordinal = anchor.getRulesetOrdinal();
            store.makeOrdinalSpace(input.rulesetId(), ordinal);
        }
        UUID id = UUID.randomUUID();
        var entity = new PatchVariant();
        entity.setId(id);
        entity.setPatchId(patchId);
        entity.setRulesetId(input.rulesetId());
        entity.setVariantCode(input.variantCode());
        entity.setRulesetOrdinal(ordinal);
        entity.setStatus("DRAFT");
        entity.setCreatedAt(clock.instant());
        insert(entity);
        record("PATCH_VARIANT_CREATED", id);
        return id;
    }

    @PreAuthorize("hasAuthority('patch:write')")
    public UUID seasonPatch(SeasonPatch input) {
        store.lockRuleset(input.rulesetId());
        var season = seasons.require(input.seasonId());
        var ordered = store.rows("""
            SELECT v.id,v.ruleset_ordinal,s.ordinal season_ordinal FROM patch.patch_variant v
            LEFT JOIN patch.ranked_season s ON s.id=v.season_id
            WHERE v.ruleset_id=? ORDER BY v.ruleset_ordinal
            """, input.rulesetId());
        UUID before = input.beforeVariantId();
        if (before != null) {
            var anchor = store.lock(PatchVariant.class, before);
            if (!input.rulesetId().equals(anchor.getRulesetId()) || !input.seasonId().equals(anchor.getSeasonId()))
                throw invalid("Choose an insertion anchor in the same season and ruleset.");
        } else {
            before = ordered.stream().filter(v -> v.get("season_ordinal") != null
                    && ((Number) v.get("season_ordinal")).longValue() > season.getOrdinal())
                    .map(v -> (UUID) v.get("id")).findFirst().orElse(null);
        }
        long ordinal = ordered.isEmpty()
                ? 1
                : Math.addExact(((Number) ordered.getLast().get("ruleset_ordinal")).longValue(), 1);
        UUID patchId = patch(input.patch());
        UUID variantId = variant(patchId, new Variant(input.rulesetId(), input.patch().code(), ordinal, before));
        store.lock(PatchVariant.class, variantId).setSeasonId(input.seasonId());
        return variantId;
    }

    @PreAuthorize("hasAuthority('patch:publish')")
    public void publish(UUID variantId) {
        store.lockRuleset(
                (UUID) store.one("SELECT ruleset_id FROM patch.patch_variant WHERE id=?", variantId).get("ruleset_id"));
        var variant = store.lock(PatchVariant.class, variantId);
        if ("PUBLISHED".equals(variant.getStatus()))
            return;
        variant.setStatus("PUBLISHED");
        variant.setPublishedAt(clock.instant());
        store.lock(GamePatch.class, variant.getPatchId()).setStatus("PUBLISHED");
        record("PATCH_VARIANT_PUBLISHED", variantId);
    }

    @PreAuthorize("hasAuthority('patch:publish')")
    public UUID release(UUID variantId, Release input) {
        store.one("SELECT id FROM patch.region WHERE id=? AND lifecycle_state='ACTIVE' FOR UPDATE", input.regionId());
        store.lockRuleset(
                (UUID) store.one("SELECT ruleset_id FROM patch.patch_variant WHERE id=?", variantId).get("ruleset_id"));
        var selectedVariant = store.lock(PatchVariant.class, variantId);
        UUID seasonId = selectedVariant.getSeasonId() == null ? input.seasonId() : selectedVariant.getSeasonId();
        if (input.seasonId() != null && !input.seasonId().equals(seasonId))
            throw invalid("The release season must match its patch season.");
        if ((input.effectiveAt() == null) == (input.effectiveOn() == null))
            throw invalid("Provide either an exact timestamp or a calendar date.");
        if (input.effectiveAt() != null)
            seasons.requireRelease(seasonId, input.regionId(), input.effectiveAt());
        else
            seasons.requireReleaseDate(seasonId, input.regionId(), input.effectiveOn());
        if (input.sourceUrl() != null && !input.sourceUrl().matches("https?://[^\s]+"))
            throw invalid("Source URL must use HTTP or HTTPS.");
        var v = store.one("SELECT * FROM patch.patch_variant WHERE id=? FOR UPDATE", variantId);
        if (!"PUBLISHED".equals(v.get("status")))
            throw invalid("Publish the variant before scheduling a release.");
        if (input.effectiveAt() != null)
            validateReleaseTime(input.regionId(), v, input.effectiveAt());
        UUID id = UUID.randomUUID();
        var entity = new PatchRelease();
        entity.setId(id);
        entity.setPatchVariantId(variantId);
        entity.setRegionId(input.regionId());
        entity.setEffectiveAt(input.effectiveAt());
        entity.setAnnouncedAt(input.announcedAt());
        entity.setEffectiveOn(input.effectiveOn());
        entity.setStatus(input.effectiveAt() == null ? "DRAFT" : "SCHEDULED");
        entity.setSourceUrl(input.sourceUrl());
        entity.setCreatedAt(clock.instant());
        entity.setSeasonId(seasonId);
        insert(entity);
        record("PATCH_RELEASE_SCHEDULED", id);
        return id;
    }

    private void validateReleaseTime(UUID regionId, Map<String, Object> v, java.time.Instant effectiveAt) {
        var time = Timestamp.from(effectiveAt);
        if (store.rows(
                "SELECT id FROM patch.region_ruleset_assignment WHERE region_id=? AND ruleset_id=? AND valid_from<=? AND (valid_to IS NULL OR valid_to>?)",
                regionId, v.get("ruleset_id"), time, time).isEmpty())
            throw invalid("The region does not use this ruleset at the release time.");
        var conflicts = store.rows("""
   SELECT rel.id FROM patch.patch_release rel JOIN patch.patch_variant v ON v.id=rel.patch_variant_id
   WHERE rel.region_id=? AND rel.status='SCHEDULED' AND v.ruleset_id=?
   AND ((rel.effective_at<=? AND v.ruleset_ordinal>=?) OR (rel.effective_at>=? AND v.ruleset_ordinal<=?))
   """, regionId, v.get("ruleset_id"), time, v.get("ruleset_ordinal"), time, v.get("ruleset_ordinal"));
        if (!conflicts.isEmpty())
            throw invalid("The release would contradict the region patch timeline.");
    }

    @PreAuthorize("hasAuthority('patch:publish')")
    public void confirmRelease(UUID releaseId) {
        var row = store.one("SELECT * FROM patch.patch_release WHERE id=?", releaseId);
        UUID regionId = (UUID) row.get("region_id");
        var region = store.lock(Region.class, regionId);
        if (!region.isAvailable())
            throw invalid("The market is unavailable.");
        var v = store.one("SELECT * FROM patch.patch_variant WHERE id=?", row.get("patch_variant_id"));
        store.lockRuleset((UUID) v.get("ruleset_id"));
        v = store.one("SELECT * FROM patch.patch_variant WHERE id=?", row.get("patch_variant_id"));
        var release = store.lock(PatchRelease.class, releaseId);
        if (release.getConfirmedAt() != null)
            return;
        if (release.getEffectiveOn() == null || !"DRAFT".equals(release.getStatus()))
            throw invalid("Only a date-only release awaiting confirmation can be confirmed.");
        var now = clock.instant();
        if (release.getEffectiveOn().isAfter(now.atZone(java.time.ZoneId.of(region.getTimezone())).toLocalDate()))
            throw invalid("A future release cannot be confirmed as applied.");
        if (!"PUBLISHED".equals(v.get("status")))
            throw invalid("Publish the variant before confirming its release.");
        seasons.requireRelease(release.getSeasonId(), regionId, now);
        validateReleaseTime(regionId, v, now);
        release.setEffectiveAt(now);
        release.setConfirmedAt(now);
        release.setStatus("SCHEDULED");
        record("PATCH_RELEASE_CONFIRMED", releaseId);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> rulesets() {
        return store.rows("SELECT id,code,description,lifecycle_state FROM patch.gameplay_ruleset ORDER BY code");
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public com.wikiaov.platform.PageSlice<Map<String, Object>> catalog(int page, int size) {
        if (page < 0 || size < 1 || size > 100)
            throw invalid("Invalid page bounds.");
        var rows = store.rows(
                "SELECT id,code,status,sequence FROM patch.game_patch ORDER BY sequence DESC LIMIT ? OFFSET ?", size,
                (long) page * size);
        var items = rows.stream().map(row -> {
            Map<String, Object> result = new java.util.LinkedHashMap<>(row);
            result.put("variants", store.rows(
                    "SELECT id,ruleset_id AS \"rulesetId\",variant_code AS \"variantCode\",ruleset_ordinal AS \"rulesetOrdinal\",status FROM patch.patch_variant WHERE patch_id=? ORDER BY ruleset_ordinal",
                    row.get("id")).stream().map(variant -> {
                        Map<String, Object> value = new java.util.LinkedHashMap<>(variant);
                        value.put("releases", store.rows(
                                "SELECT id,region_id AS \"regionId\",effective_at AS \"effectiveAt\",source_url AS \"sourceUrl\",status FROM patch.patch_release WHERE patch_variant_id=? ORDER BY effective_at",
                                variant.get("id")));
                        return value;
                    }).toList());
            return result;
        }).toList();
        long count = ((Number) store.one("SELECT count(*) n FROM patch.game_patch").get("n")).longValue();
        return new com.wikiaov.platform.PageSlice<>(items, page, size, count);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> assignments(UUID regionId) {
        return store.rows(
                "SELECT id,ruleset_id AS \"rulesetId\",valid_from AS \"validFrom\",valid_to AS \"validTo\" FROM patch.region_ruleset_assignment WHERE region_id=? ORDER BY valid_from DESC",
                regionId);
    }

    private Timestamp now() {
        return Timestamp.from(clock.instant());
    }

    private void record(String action, UUID id) {
        audit.record(AuditEntry.of(actors.require(), action, "PATCH", id));
    }

    private void insert(Object entity) {
        try {
            store.insert(entity);
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(PatchErrorCode.PATCH_CONFLICT, "The patch operation conflicts with existing data.");
        }
    }

    private void write(String sql, Object... args) {
        try {
            store.write(sql, args);
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(PatchErrorCode.PATCH_CONFLICT, "The patch operation conflicts with existing data.");
        }
    }

    private static ApiException invalid(String detail) {
        return new ApiException(PatchErrorCode.PATCH_INVALID, detail);
    }
}
