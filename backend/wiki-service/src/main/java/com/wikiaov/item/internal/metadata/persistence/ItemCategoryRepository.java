package com.wikiaov.item.internal.metadata.persistence;

import com.wikiaov.item.internal.metadata.persistence.entity.ItemCategory;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface ItemCategoryRepository extends JpaRepository<ItemCategory, String> {
    List<ItemCategory> findAllByOrderByDisplayOrderAscCodeAsc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from ItemCategory e where e.code=:code")
    Optional<ItemCategory> lockByCode(String code);
}
