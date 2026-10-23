package com.wikiaov.item.internal.catalog.persistence;

import com.wikiaov.item.internal.catalog.persistence.entity.ItemRecipeLock;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface ItemRecipeLockRepository extends JpaRepository<ItemRecipeLock, Integer> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select g from ItemRecipeLock g where g.id=1")
    Optional<ItemRecipeLock> lockGraph();
}
