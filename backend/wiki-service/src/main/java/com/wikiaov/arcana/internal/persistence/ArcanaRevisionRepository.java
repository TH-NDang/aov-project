package com.wikiaov.arcana.internal.persistence;
import com.wikiaov.arcana.internal.persistence.entity.ArcanaRevision;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ArcanaRevisionRepository extends JpaRepository<ArcanaRevision, UUID> {
    List<ArcanaRevision> findByOwnerIdOrderByRevisionNoDesc(UUID ownerId);
    List<ArcanaRevision> findByStateNot(String state);
    List<ArcanaRevision> findByIconAssetIdAndStateNot(UUID assetId, String state);
}
