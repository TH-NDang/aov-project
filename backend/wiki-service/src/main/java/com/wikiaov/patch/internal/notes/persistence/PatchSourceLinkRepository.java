package com.wikiaov.patch.internal.notes.persistence;

import com.wikiaov.patch.internal.notes.persistence.entity.PatchSourceLink;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface PatchSourceLinkRepository extends JpaRepository<PatchSourceLink, UUID> {
    List<PatchSourceLink> findByVariantIdOrderByPositionAsc(UUID variantId);

    /** Removes the links of a variant at once, so new links can take the same positions in one transaction. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from PatchSourceLink l where l.variantId = :variantId")
    int deleteByVariant(UUID variantId);
}
