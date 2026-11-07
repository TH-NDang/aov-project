package com.wikiaov.media.internal.provenance.persistence;

import com.wikiaov.media.internal.provenance.persistence.entity.MediaProvenance;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

/**
 * Spring Data repository for provenance records. Only the declared methods exist; Spring Data implements them.
 */
public interface MediaProvenanceRepository extends Repository<MediaProvenance, UUID> {

    MediaProvenance save(MediaProvenance provenance);

    void flush();

    List<MediaProvenance> findByAssetIdOrderByCreatedAtAscIdAsc(UUID assetId);

    List<MediaProvenance> findByAssetIdInOrderByCreatedAtAscIdAsc(Collection<UUID> assetIds);

    /**
     * Owner catalog changes (ADR-017) are the only rewrites of a source. Native updates, because the source columns
     * are read-only in the entity mapping.
     */
    @Modifying(flushAutomatically = true)
    @Query(value = "update media.media_provenance set owner_name = :name where owner_id = :ownerId", nativeQuery = true)
    int renameOwner(UUID ownerId, String name);

    /** Replaces the contact only where it is still the owner's previous one, keeping contacts given per source. */
    @Modifying(flushAutomatically = true)
    @Query(value = """
            update media.media_provenance set contact_url = cast(:contactUrl as varchar)
            where owner_id = :ownerId and contact_url is not distinct from cast(:previous as varchar)
            """, nativeQuery = true)
    int replaceOwnerContact(UUID ownerId, @Nullable String previous, @Nullable String contactUrl);

    @Modifying(flushAutomatically = true)
    @Query(value = """
            update media.media_provenance set owner_id = :targetId, owner_name = :name
            where owner_id = :sourceId
            """, nativeQuery = true)
    int moveOwner(UUID sourceId, UUID targetId, String name);
}
