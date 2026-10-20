package com.wikiaov.arcana.internal.persistence;
import com.wikiaov.arcana.internal.persistence.entity.ArcanaPatchChange;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ArcanaPatchChangeRepository extends JpaRepository<ArcanaPatchChange, UUID> {
    List<ArcanaPatchChange> findByRulesetId(UUID rulesetId);
    List<ArcanaPatchChange> findByOwnerId(UUID ownerId);
    boolean existsByOwnerIdAndPatchVariantId(UUID ownerId, UUID patchVariantId);
}
