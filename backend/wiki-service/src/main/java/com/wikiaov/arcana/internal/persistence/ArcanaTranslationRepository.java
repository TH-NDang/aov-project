package com.wikiaov.arcana.internal.persistence;
import com.wikiaov.arcana.internal.persistence.entity.ArcanaTranslation;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ArcanaTranslationRepository extends JpaRepository<ArcanaTranslation, UUID> {
    List<ArcanaTranslation> findByRevisionIdOrderByLocale(UUID revisionId);
    List<ArcanaTranslation> findByRevisionIdIn(Collection<UUID> ids);
    void deleteByRevisionId(UUID revisionId);
}
