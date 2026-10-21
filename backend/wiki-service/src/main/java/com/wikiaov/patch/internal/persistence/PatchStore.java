package com.wikiaov.patch.internal.persistence;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class PatchStore {
    private final JdbcClient jdbc;
    private final jakarta.persistence.EntityManager entities;

    private final GameplayRulesetRepository gameplayRulesets;
    private final RulesetAssignmentRepository rulesetAssignments;
    private final GamePatchRepository gamePatchs;
    private final PatchVariantRepository patchVariants;
    private final PatchReleaseRepository patchReleases;
    private final RegionRepository regions;

    public PatchStore(JdbcClient jdbc, jakarta.persistence.EntityManager entities,
            GameplayRulesetRepository gameplayRulesets, RulesetAssignmentRepository rulesetAssignments,
            GamePatchRepository gamePatchs, PatchVariantRepository patchVariants,
            PatchReleaseRepository patchReleases, RegionRepository regions) {
        this.jdbc = jdbc;
        this.entities = entities;
        this.gameplayRulesets = gameplayRulesets;
        this.rulesetAssignments = rulesetAssignments;
        this.gamePatchs = gamePatchs;
        this.patchVariants = patchVariants;
        this.patchReleases = patchReleases;
        this.regions = regions;
    }

    public List<Map<String, Object>> rows(String sql, Object... args) {
        entities.flush();
        return jdbc.sql(sql).params(args).query().listOfRows();
    }

    public Map<String, Object> one(String sql, Object... args) {
        return rows(sql, args).stream().findFirst()
                .orElseThrow(() -> new com.wikiaov.platform.ApiException(
                        com.wikiaov.patch.internal.application.PatchErrorCode.PATCH_NOT_FOUND,
                        "Patch resource does not exist."));
    }

    public int write(String sql, Object... args) {
        entities.flush();
        return jdbc.sql(sql).params(args).update();
    }

    public void insert(Object entity) {
        switch (entity) {
            case com.wikiaov.patch.internal.persistence.entity.Region value -> regions.saveAndFlush(value);
            case com.wikiaov.patch.internal.persistence.entity.GameplayRuleset value ->
                gameplayRulesets.saveAndFlush(value);
            case com.wikiaov.patch.internal.persistence.entity.RulesetAssignment value ->
                rulesetAssignments.saveAndFlush(value);
            case com.wikiaov.patch.internal.persistence.entity.GamePatch value -> gamePatchs.saveAndFlush(value);
            case com.wikiaov.patch.internal.persistence.entity.PatchVariant value -> patchVariants.saveAndFlush(value);
            case com.wikiaov.patch.internal.persistence.entity.PatchRelease value -> patchReleases.saveAndFlush(value);
            default -> throw new IllegalArgumentException("Unsupported patch entity.");
        }
    }

    public <T> T lock(Class<T> type, UUID id) {
        T entity = entities.find(type, id, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        if (entity == null)
            throw new com.wikiaov.platform.ApiException(
                    com.wikiaov.patch.internal.application.PatchErrorCode.PATCH_NOT_FOUND,
                    "Patch resource does not exist.");
        return entity;
    }

    public void lockRuleset(UUID id) {
        lock(com.wikiaov.patch.internal.persistence.entity.GameplayRuleset.class, id);
    }

    public record SeasonVariant(
            UUID id,
            long rulesetOrdinal,
            Long seasonOrdinal
    ) {
    }

    public List<SeasonVariant> orderedSeasonVariants(UUID rulesetId) {
        return rows("""
                SELECT v.id,v.ruleset_ordinal,s.ordinal season_ordinal FROM patch.patch_variant v
                LEFT JOIN patch.ranked_season s ON s.id=v.season_id
                WHERE v.ruleset_id=? ORDER BY v.ruleset_ordinal
                """, rulesetId).stream().map(row -> new SeasonVariant((UUID) row.get("id"),
                ((Number) row.get("ruleset_ordinal")).longValue(), row.get("season_ordinal") == null
                        ? null
                        : ((Number) row.get("season_ordinal")).longValue()))
                .toList();
    }

    public void makeOrdinalSpace(UUID rulesetId, long ordinal) {
        var later = entities.createQuery(
                "SELECT v FROM PatchVariant v WHERE v.rulesetId=:ruleset AND v.rulesetOrdinal>=:ordinal ORDER BY v.rulesetOrdinal DESC",
                com.wikiaov.patch.internal.persistence.entity.PatchVariant.class)
                .setParameter("ruleset", rulesetId).setParameter("ordinal", ordinal).getResultList();
        for (var variant : later) {
            variant.setRulesetOrdinal(Math.addExact(variant.getRulesetOrdinal(), 1));
            entities.flush();
        }
    }
}
