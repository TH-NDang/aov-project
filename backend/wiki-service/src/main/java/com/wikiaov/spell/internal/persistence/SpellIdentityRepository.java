package com.wikiaov.spell.internal.persistence;
import com.wikiaov.spell.internal.persistence.entity.SpellIdentity;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;
public interface SpellIdentityRepository extends JpaRepository<SpellIdentity, UUID> {
    Optional<SpellIdentity> findByCode(String code);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from SpellIdentity e where e.id=:id")
    Optional<SpellIdentity> lockById(UUID id);
}
