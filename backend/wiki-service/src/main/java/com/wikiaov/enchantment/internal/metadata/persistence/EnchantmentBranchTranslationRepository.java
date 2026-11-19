package com.wikiaov.enchantment.internal.metadata.persistence;

import com.wikiaov.enchantment.internal.metadata.persistence.entity.EnchantmentBranchTranslation;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EnchantmentBranchTranslationRepository extends JpaRepository<EnchantmentBranchTranslation, UUID> {
    List<EnchantmentBranchTranslation> findByOwnerCodeInOrderByLocale(Collection<String> codes);

    List<EnchantmentBranchTranslation> findByOwnerCodeOrderByLocale(String code);

    void deleteByOwnerCode(String code);
}
