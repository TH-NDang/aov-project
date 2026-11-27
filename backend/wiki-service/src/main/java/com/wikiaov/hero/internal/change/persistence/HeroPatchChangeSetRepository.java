package com.wikiaov.hero.internal.change.persistence;

import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchChangeSet;
import com.wikiaov.hero.internal.domain.HeroChanges.ChangeSource;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HeroPatchChangeSetRepository extends JpaRepository<HeroPatchChangeSet, UUID> {
    List<HeroPatchChangeSet> findByHeroIdInAndPatchVariantIdIn(Collection<UUID> heroIds, Collection<UUID> variants);

    @Query("""
            select c.id as id, c.heroId as heroId, h.code as heroCode, c.patchVariantId as patchVariantId,
                c.fromHeroRevisionId as fromHeroRevisionId, c.toHeroRevisionId as toHeroRevisionId,
                c.sourceKind as sourceKind, c.sourceUrl as sourceUrl, c.introducesHero as introducesHero
            from HeroPatchChangeSet c join HeroIdentity h on h.id = c.heroId
                left join HeroPatchChangePosition p on p.changeSetId = c.id
            where c.patchVariantId = :variantId order by p.position asc nulls first, c.createdAt desc, c.id
            """)
    List<Header> historyForVariant(@Param("variantId") UUID variantId);

    @Query("select c.id as id, c.heroId as heroId from HeroPatchChangeSet c where c.patchVariantId = :variantId")
    List<Member> membersOfVariant(@Param("variantId") UUID variantId);

    @Query("""
            select c.id as id, c.heroId as heroId, h.code as heroCode, c.patchVariantId as patchVariantId,
                c.fromHeroRevisionId as fromHeroRevisionId, c.toHeroRevisionId as toHeroRevisionId,
                c.sourceKind as sourceKind, c.sourceUrl as sourceUrl, c.introducesHero as introducesHero
            from HeroPatchChangeSet c join HeroIdentity h on h.id = c.heroId
            where c.heroId = :heroId order by c.createdAt desc, c.id
            """)
    List<Header> historyForHero(@Param("heroId") UUID heroId);

    @Query("select c.heroId from HeroPatchChangeSet c where c.id = :id")
    Optional<UUID> findHeroId(@Param("id") UUID id);

    /** The patch that introduced each hero that has one (ADR-016). */
    @Query("select c.heroId as heroId, c.patchVariantId as patchVariantId from HeroPatchChangeSet c where c.introducesHero = true")
    List<Introduction> introductions();

    boolean existsByHeroIdAndIntroducesHeroTrue(UUID heroId);

    boolean existsByIdAndIntroducesHeroTrue(UUID id);

    interface Header {
        UUID getId();

        UUID getHeroId();

        String getHeroCode();

        UUID getPatchVariantId();

        UUID getFromHeroRevisionId();

        UUID getToHeroRevisionId();

        ChangeSource getSourceKind();

        String getSourceUrl();

        boolean getIntroducesHero();
    }

    /** A change set of a patch variant and the hero it belongs to. */
    interface Member {
        UUID getId();

        UUID getHeroId();
    }

    interface Introduction {
        UUID getHeroId();

        UUID getPatchVariantId();
    }
}
