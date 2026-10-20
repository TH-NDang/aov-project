package com.wikiaov.item.internal.persistence;
import com.wikiaov.item.internal.persistence.entity.ItemRevision;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ItemRevisionRepository extends JpaRepository<ItemRevision, UUID> {
    List<ItemRevision> findByOwnerIdOrderByRevisionNoDesc(UUID ownerId);
    List<ItemRevision> findByStateNot(String state);
    List<ItemRevision> findByIconAssetIdAndStateNot(UUID assetId, String state);
}
