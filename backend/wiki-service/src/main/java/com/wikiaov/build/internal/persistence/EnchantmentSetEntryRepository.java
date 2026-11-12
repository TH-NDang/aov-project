package com.wikiaov.build.internal.persistence;

import com.wikiaov.build.internal.persistence.entity.EnchantmentSetEntryRow;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EnchantmentSetEntryRepository
        extends
            JpaRepository<EnchantmentSetEntryRow, EnchantmentSetEntryRow.Key> {
    List<EnchantmentSetEntryRow> findBySetIdIn(Collection<java.util.UUID> setIds);
}
