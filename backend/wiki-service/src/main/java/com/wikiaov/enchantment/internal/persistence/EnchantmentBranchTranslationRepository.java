package com.wikiaov.enchantment.internal.persistence;
import com.wikiaov.enchantment.internal.persistence.entity.EnchantmentBranchTranslation;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface EnchantmentBranchTranslationRepository extends JpaRepository<EnchantmentBranchTranslation, UUID> {
    List<EnchantmentBranchTranslation> findByOwnerCodeOrderByLocale(String code);
    void deleteByOwnerCode(String code);
}
