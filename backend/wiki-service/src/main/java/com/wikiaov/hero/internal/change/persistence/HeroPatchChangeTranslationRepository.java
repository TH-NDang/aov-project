package com.wikiaov.hero.internal.change.persistence;

import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchChangeTranslation;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HeroPatchChangeTranslationRepository
        extends
            JpaRepository<HeroPatchChangeTranslation, HeroPatchChangeTranslation.Key> {
    List<HeroPatchChangeTranslation> findByChangeSetIdIn(Collection<UUID> ids);
}
