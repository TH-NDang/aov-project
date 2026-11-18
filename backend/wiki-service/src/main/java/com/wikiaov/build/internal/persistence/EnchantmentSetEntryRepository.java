package com.wikiaov.build.internal.persistence;

import com.wikiaov.build.internal.persistence.entity.EnchantmentSetEntryRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EnchantmentSetEntryRepository
        extends
            JpaRepository<EnchantmentSetEntryRow, EnchantmentSetEntryRow.Key> {
    List<EnchantmentSetEntryRow> findBySetIdIn(Collection<UUID> setIds);
}
