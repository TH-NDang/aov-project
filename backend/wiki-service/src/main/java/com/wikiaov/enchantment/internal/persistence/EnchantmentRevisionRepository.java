package com.wikiaov.enchantment.internal.persistence;
import com.wikiaov.enchantment.internal.persistence.entity.EnchantmentRevision;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface EnchantmentRevisionRepository extends JpaRepository<EnchantmentRevision, UUID> {
    List<EnchantmentRevision> findByOwnerIdOrderByRevisionNoDesc(UUID ownerId);
    List<EnchantmentRevision> findByStateNot(String state);
    List<EnchantmentRevision> findByIconAssetIdAndStateNot(UUID assetId, String state);
}
