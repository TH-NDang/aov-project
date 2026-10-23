package com.wikiaov.enchantment.internal.metadata.persistence;

import com.wikiaov.enchantment.internal.metadata.persistence.entity.EnchantmentBranchTranslation;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EnchantmentBranchTranslationRepository extends JpaRepository<EnchantmentBranchTranslation, UUID> {
    List<EnchantmentBranchTranslation> findByOwnerCodeOrderByLocale(String code);

    void deleteByOwnerCode(String code);
}
