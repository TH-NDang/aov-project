package com.wikiaov.media.internal.provenance.persistence;

import com.wikiaov.media.internal.provenance.persistence.entity.MediaProvenance;
import java.util.List;
import java.util.UUID;
import org.springframework.data.repository.Repository;

/**
 * Spring Data repository for provenance records. Only the declared methods exist; Spring Data implements them.
 */
public interface MediaProvenanceRepository extends Repository<MediaProvenance, UUID> {

    MediaProvenance save(MediaProvenance provenance);

    List<MediaProvenance> findByAssetIdOrderByCreatedAtAsc(UUID assetId);
}
