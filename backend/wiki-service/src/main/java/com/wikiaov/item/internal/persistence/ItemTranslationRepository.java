package com.wikiaov.item.internal.persistence;
import com.wikiaov.item.internal.persistence.entity.ItemTranslation;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ItemTranslationRepository extends JpaRepository<ItemTranslation, UUID> {
    List<ItemTranslation> findByRevisionIdOrderByLocale(UUID revisionId);
    List<ItemTranslation> findByRevisionIdIn(Collection<UUID> ids);
    void deleteByRevisionId(UUID revisionId);
}
