package com.wikiaov.enchantment.internal.metadata.persistence;

import com.wikiaov.enchantment.internal.metadata.persistence.entity.EnchantmentBranch;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface EnchantmentBranchRepository extends JpaRepository<EnchantmentBranch, String> {
    List<EnchantmentBranch> findAllByOrderByDisplayOrderAscCodeAsc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from EnchantmentBranch e where e.code=:code")
    Optional<EnchantmentBranch> lockByCode(String code);
}
