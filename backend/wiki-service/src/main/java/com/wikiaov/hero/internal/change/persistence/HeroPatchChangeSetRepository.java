package com.wikiaov.hero.internal.change.persistence;

import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchChangeSet;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HeroPatchChangeSetRepository extends JpaRepository<HeroPatchChangeSet, UUID> {
    List<HeroPatchChangeSet> findByHeroIdInAndPatchVariantIdIn(Collection<UUID> heroIds, Collection<UUID> variants);

    List<HeroPatchChangeSet> findByPatchVariantIdOrderByCreatedAtDescId(UUID variantId);

    List<HeroPatchChangeSet> findByHeroIdOrderByCreatedAtDescId(UUID heroId);

    @Query("""
            select c.id as id, c.heroId as heroId, h.code as heroCode, c.patchVariantId as patchVariantId,
                c.fromHeroRevisionId as fromHeroRevisionId, c.toHeroRevisionId as toHeroRevisionId
            from HeroPatchChangeSet c join HeroIdentity h on h.id = c.heroId
            where c.patchVariantId = :variantId order by c.createdAt desc, c.id
            """)
    List<Header> historyForVariant(@Param("variantId") UUID variantId);

    @Query("""
            select c.id as id, c.heroId as heroId, h.code as heroCode, c.patchVariantId as patchVariantId,
                c.fromHeroRevisionId as fromHeroRevisionId, c.toHeroRevisionId as toHeroRevisionId
            from HeroPatchChangeSet c join HeroIdentity h on h.id = c.heroId
            where c.heroId = :heroId order by c.createdAt desc, c.id
            """)
    List<Header> historyForHero(@Param("heroId") UUID heroId);

    @Query("select c.heroId from HeroPatchChangeSet c where c.id = :id")
    Optional<UUID> findHeroId(@Param("id") UUID id);

    interface Header {
        UUID getId();

        UUID getHeroId();

        String getHeroCode();

        UUID getPatchVariantId();

        UUID getFromHeroRevisionId();

        UUID getToHeroRevisionId();
    }
}
