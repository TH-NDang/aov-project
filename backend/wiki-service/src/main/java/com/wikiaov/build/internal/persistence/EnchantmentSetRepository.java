package com.wikiaov.build.internal.persistence;

import com.wikiaov.build.internal.persistence.entity.EnchantmentSetRow;
import java.time.Instant;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface EnchantmentSetRepository extends JpaRepository<EnchantmentSetRow, UUID> {
    Optional<EnchantmentSetRow> findByContentKey(String contentKey);

    /** Native upsert: a concurrent writer of the same content waits on the unique key instead of failing. */
    @Modifying
    @Query(value = "INSERT INTO build.enchantment_set (id, content_key, created_at) VALUES (:id, :contentKey, :createdAt) "
            + "ON CONFLICT (content_key) DO NOTHING", nativeQuery = true)
    int insertIfAbsent(UUID id, String contentKey, Instant createdAt);

    /** Removes the given values that no build uses any more; their entries go with them. */
    @Modifying
    @Query(value = "DELETE FROM build.enchantment_set v WHERE v.id IN (:ids) "
            + "AND NOT EXISTS (SELECT 1 FROM build.build b WHERE b.enchantment_set_id = v.id)", nativeQuery = true)
    int deleteUnused(Collection<UUID> ids);
}
