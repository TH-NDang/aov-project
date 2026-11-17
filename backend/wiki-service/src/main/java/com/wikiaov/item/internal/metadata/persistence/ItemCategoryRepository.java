package com.wikiaov.item.internal.metadata.persistence;

import com.wikiaov.item.internal.metadata.persistence.entity.ItemCategory;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface ItemCategoryRepository extends JpaRepository<ItemCategory, String> {
    List<ItemCategory> findAllByOrderByDisplayOrderAscCodeAsc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from ItemCategory e where e.code=:code")
    Optional<ItemCategory> lockByCode(String code);
}
