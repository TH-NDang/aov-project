package com.wikiaov.patch.internal.context.persistence;

import com.wikiaov.patch.AuthoringContext;
import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.PatchReleaseReference;
import com.wikiaov.patch.internal.release.persistence.entity.PatchRelease;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

/** Read projections for shared editing contexts and verified market releases. */
public interface GameplayContextRepository extends Repository<PatchRelease, UUID> {
    @Query("""
            select new com.wikiaov.patch.GameplayContext(r.id,r.code,rs.id,rs.code,
                p.id,p.code,v.id,v.rulesetOrdinal,rel.effectiveAt)
            from Region r join RulesetAssignment a on a.regionId=r.id
            join GameplayRuleset rs on rs.id=a.rulesetId and rs.lifecycleState='ACTIVE'
            join PatchRelease rel on rel.regionId=r.id and rel.status='SCHEDULED' and rel.effectiveAt<=:at
            join PatchVariant v on v.id=rel.patchVariantId and v.rulesetId=rs.id and v.status='PUBLISHED'
            join GamePatch p on p.id=v.patchId and p.status='PUBLISHED'
            where r.code=:region and a.validFrom<=:at and (a.validTo is null or a.validTo>:at)
            order by rel.effectiveAt desc
            """)
    List<GameplayContext> effective(String region, Instant at, Pageable page);

    @Query("""
            select new com.wikiaov.patch.PatchReleaseReference(p.id,v.id,v.rulesetId,rel.effectiveAt)
            from PatchRelease rel join Region r on r.id=rel.regionId
            join PatchVariant v on v.id=rel.patchVariantId and v.status='PUBLISHED'
            join GamePatch p on p.id=v.patchId and p.status='PUBLISHED'
            where r.code=:region and rel.status='SCHEDULED' order by p.sequence desc,rel.effectiveAt desc
            """)
    List<PatchReleaseReference> publishedReleases(String region);

    String MARKET_AUTHORING = """
            select new com.wikiaov.patch.AuthoringContext(rel.id,r.id,r.code,s.id,s.displayName,
                v.rulesetId,v.id,p.code,v.rulesetOrdinal,rel.effectiveAt)
            from PatchRelease rel join Region r on r.id=rel.regionId and r.lifecycleState='ACTIVE'
            join SeasonSchedule schedule on schedule.regionId=r.id
                and rel.effectiveAt>=schedule.startsAt and rel.effectiveAt<schedule.endsAt
                and (rel.seasonId is null or rel.seasonId=schedule.seasonId)
            join RankedSeason s on s.id=schedule.seasonId
            join PatchVariant v on v.id=rel.patchVariantId and v.status='PUBLISHED'
            join GamePatch p on p.id=v.patchId and p.status='PUBLISHED'
            join GameplayRuleset rs on rs.id=v.rulesetId and rs.lifecycleState='ACTIVE'
            where rel.status='SCHEDULED'
            """;

    String SHARED_AUTHORING = """
            select new com.wikiaov.patch.AuthoringContext(v.id,null,null,s.id,s.displayName,
                v.rulesetId,v.id,p.code,v.rulesetOrdinal,null)
            from PatchVariant v join GamePatch p on p.id=v.patchId
            join RankedSeason s on s.id=v.seasonId
            join GameplayRuleset rs on rs.id=v.rulesetId and rs.lifecycleState='ACTIVE'
            where v.status in ('DRAFT','PUBLISHED')
            """;

    @Query(MARKET_AUTHORING + " and r.id=:regionId and s.id=:seasonId order by rel.effectiveAt")
    List<AuthoringContext> authoringByMarket(UUID regionId, UUID seasonId);

    @Query(SHARED_AUTHORING + " and s.id=:seasonId order by v.rulesetOrdinal")
    List<AuthoringContext> authoringBySeason(UUID seasonId);

    @Query(SHARED_AUTHORING + " and v.id=:contextId")
    List<AuthoringContext> sharedAuthoringContext(UUID contextId);

    @Query(MARKET_AUTHORING + " and rel.id=:contextId")
    List<AuthoringContext> legacyAuthoringContext(UUID contextId);
}
