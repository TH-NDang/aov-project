package com.wikiaov.patch.internal.application.service;
import com.wikiaov.access.*;
import com.wikiaov.patch.internal.application.PatchCommands.*;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.persistence.PatchStore;
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
    public PatchAuthoring(PatchStore store, CurrentActor actors, AuditLog audit, Clock clock) {
        this.store = store;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }
    @PreAuthorize("hasAuthority('region:admin')")
    public UUID ruleset(Ruleset input) {
        UUID id = UUID.randomUUID();
        write("INSERT INTO patch.gameplay_ruleset(id,code,description,created_at) VALUES(?,?,?,?)", id, input.code(),
                input.description(), now());
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
        write("INSERT INTO patch.region_ruleset_assignment VALUES(?,?,?,?,?)", id, regionId, input.rulesetId(),
                Timestamp.from(input.validFrom()), input.validTo() == null ? null : Timestamp.from(input.validTo()));
        record("REGION_RULESET_ASSIGNED", id);
        return id;
    }
    @PreAuthorize("hasAuthority('patch:write')")
    public UUID patch(Patch input) {
        UUID id = UUID.randomUUID();
        var actor = actors.require();
        write("INSERT INTO patch.game_patch(id,code,created_at,created_by_issuer,created_by_subject) VALUES(?,?,?,?,?)",
                id, input.code(), now(), actor.issuer(), actor.subject());
        for (var t : input.translations())
            write("INSERT INTO patch.game_patch_translation VALUES(?,?,?,?,?)", id, t.locale(), t.title(), t.summary(),
                    t.description());
        record("PATCH_CREATED", id);
        return id;
    }
    @PreAuthorize("hasAuthority('patch:write')")
    public UUID variant(UUID patchId, Variant input) {
        store.one("SELECT id FROM patch.game_patch WHERE id=? FOR UPDATE", patchId);
        store.lockRuleset(input.rulesetId());
        long max = ((Number) store
                .one("SELECT coalesce(max(ruleset_ordinal),0) n FROM patch.patch_variant WHERE ruleset_id=?",
                        input.rulesetId())
                .get("n")).longValue();
        if (input.rulesetOrdinal() <= max)
            throw invalid("The ordinal must follow all existing variants of this ruleset.");
        UUID id = UUID.randomUUID();
        write("INSERT INTO patch.patch_variant(id,patch_id,ruleset_id,variant_code,ruleset_ordinal,created_at) VALUES(?,?,?,?,?,?)",
                id, patchId, input.rulesetId(), input.variantCode(), input.rulesetOrdinal(), now());
        record("PATCH_VARIANT_CREATED", id);
        return id;
    }
    @PreAuthorize("hasAuthority('patch:publish')")
    public void publish(UUID variantId) {
        var v = store.one("SELECT * FROM patch.patch_variant WHERE id=? FOR UPDATE", variantId);
        if ("PUBLISHED".equals(v.get("status")))
            return;
        write("UPDATE patch.patch_variant SET status='PUBLISHED',published_at=? WHERE id=?", now(), variantId);
        write("UPDATE patch.game_patch SET status='PUBLISHED' WHERE id=?", v.get("patch_id"));
        record("PATCH_VARIANT_PUBLISHED", variantId);
    }
    @PreAuthorize("hasAuthority('patch:publish')")
    public UUID release(UUID variantId, Release input) {
        if (input.sourceUrl() != null && !input.sourceUrl().matches("https?://[^\s]+"))
            throw invalid("Source URL must use HTTP or HTTPS.");
        store.one("SELECT id FROM patch.region WHERE id=? AND lifecycle_state='ACTIVE' FOR UPDATE", input.regionId());
        var v = store.one("SELECT * FROM patch.patch_variant WHERE id=? FOR UPDATE", variantId);
        if (!"PUBLISHED".equals(v.get("status")))
            throw invalid("Publish the variant before scheduling a release.");
        var time = Timestamp.from(input.effectiveAt());
        if (store.rows(
                "SELECT id FROM patch.region_ruleset_assignment WHERE region_id=? AND ruleset_id=? AND valid_from<=? AND (valid_to IS NULL OR valid_to>?)",
                input.regionId(), v.get("ruleset_id"), time, time).isEmpty())
            throw invalid("The region does not use this ruleset at the release time.");
        var conflicts = store.rows("""
   SELECT rel.id FROM patch.patch_release rel JOIN patch.patch_variant v ON v.id=rel.patch_variant_id
   WHERE rel.region_id=? AND rel.status='SCHEDULED' AND v.ruleset_id=?
   AND ((rel.effective_at<=? AND v.ruleset_ordinal>=?) OR (rel.effective_at>=? AND v.ruleset_ordinal<=?))
   """, input.regionId(), v.get("ruleset_id"), time, v.get("ruleset_ordinal"), time, v.get("ruleset_ordinal"));
        if (!conflicts.isEmpty())
            throw invalid("The release would contradict the region patch timeline.");
        UUID id = UUID.randomUUID();
        write("INSERT INTO patch.patch_release(id,patch_variant_id,region_id,effective_at,announced_at,source_url,created_at) VALUES(?,?,?,?,?,?,?)",
                id, variantId, input.regionId(), time,
                input.announcedAt() == null ? null : Timestamp.from(input.announcedAt()), input.sourceUrl(), now());
        record("PATCH_RELEASE_SCHEDULED", id);
        return id;
    }
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> rulesets() {
        return store.rows("SELECT id,code,description,lifecycle_state FROM patch.gameplay_ruleset ORDER BY code");
    }
    private Timestamp now() {
        return Timestamp.from(clock.instant());
    }
    private void record(String action, UUID id) {
        audit.record(AuditEntry.of(actors.require(), action, "PATCH", id));
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
