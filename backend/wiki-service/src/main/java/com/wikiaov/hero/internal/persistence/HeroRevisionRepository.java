package com.wikiaov.hero.internal.persistence;

import com.wikiaov.hero.internal.persistence.entity.HeroRevision;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HeroRevisionRepository extends JpaRepository<HeroRevision, UUID> {
    Optional<HeroRevision> findByHeroIdAndId(UUID heroId, UUID id);
    List<HeroRevision> findByHeroIdOrderByRevisionNoDesc(UUID heroId);
    List<HeroRevision> findByHeroIdInOrderByRevisionNoDesc(Collection<UUID> heroIds);
}
