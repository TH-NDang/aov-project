package com.wikiaov.media.internal.source.persistence;

import com.wikiaov.media.internal.source.persistence.entity.SourceFile;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** Files of source collections. Only the declared methods exist; Spring Data implements them. */
public interface SourceFileRepository extends Repository<SourceFile, UUID> {

    Optional<SourceFile> findById(UUID id);

    Optional<SourceFile> findByCollectionIdAndPath(UUID collectionId, String path);

    List<SourceFile> findByCollectionIdAndPathIn(UUID collectionId, Collection<String> paths);

    SourceFile saveAndFlush(SourceFile file);

    void delete(SourceFile file);

    long countBySha256(String sha256);

    /**
     * Files of a collection with the size and type of their bytes, ordered by path. {@code folder} is a LIKE pattern
     * matching every path below a folder; {@code pattern} a lower-case LIKE pattern on the path.
     */
    @Query(value = """
            select f.id as id, f.path as path, f.sha256 as sha256, o.sizeBytes as sizeBytes,
                   o.contentType as contentType, f.createdAt as createdAt, f.updatedAt as updatedAt,
                   f.lockVersion as version
            from SourceFile f join SourceObject o on o.sha256 = f.sha256
            where f.collectionId = :collectionId
              and f.path like :folder escape '\\'
              and lower(f.path) like :pattern escape '\\'
            order by f.path, f.id
            """, countQuery = """
            select count(f) from SourceFile f
            where f.collectionId = :collectionId
              and f.path like :folder escape '\\'
              and lower(f.path) like :pattern escape '\\'
            """)
    Page<FileRow> search(@Param("collectionId") UUID collectionId, @Param("folder") String folder,
            @Param("pattern") String pattern, Pageable pageable);

    /** Other places of the same bytes, oldest first, with the code of their collection. */
    @Query("""
            select f.id as fileId, c.code as collectionCode, f.path as path
            from SourceFile f join SourceCollection c on c.id = f.collectionId
            where f.sha256 = :sha256 and f.id <> :excluded
            order by f.createdAt, f.id
            """)
    List<PlaceRow> findOtherPlaces(@Param("sha256") String sha256, @Param("excluded") UUID excluded,
            Pageable limit);

    interface FileRow {
        UUID getId();

        String getPath();

        String getSha256();

        long getSizeBytes();

        String getContentType();

        Instant getCreatedAt();

        Instant getUpdatedAt();

        long getVersion();
    }

    interface PlaceRow {
        UUID getFileId();

        String getCollectionCode();

        String getPath();
    }
}
