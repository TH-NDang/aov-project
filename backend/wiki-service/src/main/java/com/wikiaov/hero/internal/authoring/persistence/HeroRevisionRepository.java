package com.wikiaov.hero.internal.authoring.persistence;

import com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HeroRevisionRepository
        extends
            JpaRepository<HeroRevision, UUID>,
            org.springframework.data.jpa.repository.JpaSpecificationExecutor<HeroRevision> {
    Optional<HeroRevision> findByHeroIdAndId(UUID heroId, UUID id);

    List<HeroRevision> findByHeroIdOrderByRevisionNoDesc(UUID heroId);

    List<HeroRevision> findByHeroIdInOrderByRevisionNoDesc(Collection<UUID> heroIds);

    interface EditedTime {
        UUID getHeroId();

        Instant getUpdatedAt();
    }

    @org.springframework.data.jpa.repository.Query("select r.heroId as heroId,max(r.updatedAt) as updatedAt from HeroRevision r where r.heroId in :ids group by r.heroId")
    List<EditedTime> editedTimes(Collection<UUID> ids);

    boolean existsByStateAndProfileRevisionId(String state, UUID id);

    boolean existsByStateAndOverviewRatingRevisionId(String state, UUID id);

    boolean existsByStateAndCombatStatsRevisionId(String state, UUID id);

    boolean existsByStateAndSkillsRevisionId(String state, UUID id);

    boolean existsByStateAndSkinsRevisionId(String state, UUID id);

    boolean existsByStateAndMediaBindingRevisionId(String state, UUID id);
}
