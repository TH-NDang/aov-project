package com.wikiaov.item.internal.persistence;
import com.wikiaov.item.internal.persistence.entity.ItemIdentity;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;
public interface ItemIdentityRepository extends JpaRepository<ItemIdentity, UUID> {
    Optional<ItemIdentity> findByCode(String code);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from ItemIdentity e where e.id=:id")
    Optional<ItemIdentity> lockById(UUID id);
}
