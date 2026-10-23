package com.wikiaov.enchantment.internal.metadata.persistence;

import com.wikiaov.enchantment.internal.metadata.persistence.entity.EnchantmentBranch;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface EnchantmentBranchRepository extends JpaRepository<EnchantmentBranch, String> {
    List<EnchantmentBranch> findAllByOrderByDisplayOrderAscCodeAsc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from EnchantmentBranch e where e.code=:code")
    Optional<EnchantmentBranch> lockByCode(String code);
}
