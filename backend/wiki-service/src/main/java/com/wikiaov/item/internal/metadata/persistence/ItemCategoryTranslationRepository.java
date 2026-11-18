package com.wikiaov.item.internal.metadata.persistence;

import com.wikiaov.item.internal.metadata.persistence.entity.ItemCategoryTranslation;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItemCategoryTranslationRepository extends JpaRepository<ItemCategoryTranslation, UUID> {
    List<ItemCategoryTranslation> findByOwnerCodeInOrderByLocale(Collection<String> codes);

    List<ItemCategoryTranslation> findByOwnerCodeOrderByLocale(String code);

    void deleteByOwnerCode(String code);
}
