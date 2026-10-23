package com.wikiaov.hero.internal.badges.persistence;

import com.wikiaov.hero.internal.badges.persistence.entity.SkinBadgeGroupTranslation;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkinBadgeGroupTranslationRepository
        extends
            JpaRepository<SkinBadgeGroupTranslation, SkinBadgeGroupTranslation.Key> {
    List<SkinBadgeGroupTranslation> findByGroupIdIn(Collection<UUID> ids, Sort sort);
}
