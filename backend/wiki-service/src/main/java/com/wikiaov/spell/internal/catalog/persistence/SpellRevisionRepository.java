package com.wikiaov.spell.internal.catalog.persistence;

import com.wikiaov.spell.internal.catalog.persistence.entity.SpellRevision;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SpellRevisionRepository extends JpaRepository<SpellRevision, UUID> {
    List<SpellRevision> findByOwnerIdOrderByRevisionNoDesc(UUID ownerId);

    List<SpellRevision> findByStateNot(String state);

    List<SpellRevision> findByIconAssetIdAndStateNot(UUID assetId, String state);
}
