package com.wikiaov.enchantment.internal.persistence;
import com.wikiaov.enchantment.internal.persistence.entity.EnchantmentIdentity;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;
public interface EnchantmentIdentityRepository extends JpaRepository<EnchantmentIdentity, UUID> {
    Optional<EnchantmentIdentity> findByCode(String code);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from EnchantmentIdentity e where e.id=:id")
    Optional<EnchantmentIdentity> lockById(UUID id);
}
