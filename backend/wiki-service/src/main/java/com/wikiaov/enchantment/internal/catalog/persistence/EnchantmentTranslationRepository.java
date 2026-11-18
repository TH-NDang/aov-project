package com.wikiaov.enchantment.internal.catalog.persistence;

import com.wikiaov.enchantment.internal.catalog.persistence.entity.EnchantmentTranslation;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EnchantmentTranslationRepository extends JpaRepository<EnchantmentTranslation, UUID> {
    List<EnchantmentTranslation> findByRevisionIdOrderByLocale(UUID revisionId);

    List<EnchantmentTranslation> findByRevisionIdIn(Collection<UUID> ids);

    void deleteByRevisionId(UUID revisionId);
}
