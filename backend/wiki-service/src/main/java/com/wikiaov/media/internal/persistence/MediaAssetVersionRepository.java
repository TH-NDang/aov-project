package com.wikiaov.media.internal.persistence;

import com.wikiaov.media.internal.persistence.entity.MediaAssetVersion;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.repository.Repository;

/**
 * Spring Data repository for asset versions. Only the declared methods exist; Spring Data implements them.
 */
public interface MediaAssetVersionRepository extends Repository<MediaAssetVersion, UUID> {

    Optional<MediaAssetVersion> findById(UUID id);

    MediaAssetVersion save(MediaAssetVersion version);

    List<MediaAssetVersion> findByAssetIdOrderByVersionNoDesc(UUID assetId);

    List<MediaAssetVersion> findByIdIn(Collection<UUID> ids);

    Optional<MediaAssetVersion> findByAssetIdAndSha256(UUID assetId, String sha256);
}
