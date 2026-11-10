package com.wikiaov.hero.internal.forms.persistence;

import com.wikiaov.hero.internal.forms.persistence.entity.HeroFormMembership;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface HeroFormRepository extends JpaRepository<HeroFormMembership, UUID> {
    List<HeroFormMembership> findAllByOrderByParentHeroIdAscDisplayOrderAsc();

    List<HeroFormMembership> findByParentHeroIdOrderByDisplayOrderAsc(UUID parentHeroId);

    boolean existsByParentHeroId(UUID parentHeroId);

    /** Runs immediately, so a replaced list can reuse keys and positions in the same transaction. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from HeroFormMembership f where f.parentHeroId = :parentHeroId")
    void deleteByParentHeroId(UUID parentHeroId);
}
