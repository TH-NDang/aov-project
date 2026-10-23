package com.wikiaov.item.internal.metadata.persistence;

import com.wikiaov.item.internal.metadata.persistence.entity.ItemCategoryTranslation;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItemCategoryTranslationRepository extends JpaRepository<ItemCategoryTranslation, UUID> {
    List<ItemCategoryTranslation> findByOwnerCodeOrderByLocale(String code);

    void deleteByOwnerCode(String code);
}
