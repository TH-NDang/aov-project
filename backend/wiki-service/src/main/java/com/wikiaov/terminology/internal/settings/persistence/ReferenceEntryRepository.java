package com.wikiaov.terminology.internal.settings.persistence;

import com.wikiaov.terminology.internal.settings.persistence.entity.ReferenceEntry;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReferenceEntryRepository extends JpaRepository<ReferenceEntry, UUID> {
    List<ReferenceEntry> findAllByOrderByDisplayOrderAsc();
}
