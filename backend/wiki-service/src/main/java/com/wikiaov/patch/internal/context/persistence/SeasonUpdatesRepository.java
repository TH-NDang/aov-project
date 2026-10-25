package com.wikiaov.patch.internal.context.persistence;

import com.wikiaov.patch.internal.release.persistence.entity.PatchRelease;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

/** Published read projections for the current market season, independent of admin overview data. */
public interface SeasonUpdatesRepository extends Repository<PatchRelease, UUID> {
    @Query("""
            select s.id as id,s.code as code,s.displayName as displayName
            from PatchRelease rel join PatchVariant v on v.id=rel.patchVariantId
            join RankedSeason s on s.id=coalesce(rel.seasonId,v.seasonId)
            where rel.regionId=:regionId and v.id=:variantId and rel.status='SCHEDULED'
                and rel.effectiveAt<=:at
            order by rel.effectiveAt desc,rel.id
            """)
    List<Season> currentSeason(UUID regionId, UUID variantId, Instant at, Pageable page);

    @Query("""
            select p.id as id,p.code as code,rel.effectiveAt as effectiveAt,
                rel.effectiveOn as effectiveOn,rel.sourceUrl as sourceUrl
            from PatchRelease rel join PatchVariant v on v.id=rel.patchVariantId
            join GamePatch p on p.id=v.patchId
            where rel.regionId=:regionId and v.rulesetId=:rulesetId
                and coalesce(rel.seasonId,v.seasonId)=:seasonId
                and rel.status='SCHEDULED' and rel.effectiveAt<=:at
                and v.status='PUBLISHED' and p.status='PUBLISHED'
            order by rel.effectiveAt desc,v.rulesetOrdinal desc,rel.id
            """)
    List<Release> publishedReleases(UUID regionId, UUID rulesetId, UUID seasonId, Instant at, Pageable page);

    @Query("""
            select t.patchId as patchId,t.locale as locale,t.title as title,t.summary as summary
            from GamePatchTranslation t where t.patchId in :patchIds
            order by t.patchId,case when t.locale=:locale then 0 when t.locale='vi-VN' then 1 else 2 end,t.locale
            """)
    List<Text> preferredTexts(Collection<UUID> patchIds, String locale);

    interface Season {
        UUID getId();

        String getCode();

        String getDisplayName();
    }

    interface Release {
        UUID getId();

        String getCode();

        Instant getEffectiveAt();

        LocalDate getEffectiveOn();

        String getSourceUrl();
    }

    interface Text {
        UUID getPatchId();

        String getLocale();

        String getTitle();

        String getSummary();
    }
}
