package com.wikiaov.media.internal.source.persistence;

import com.wikiaov.media.internal.source.domain.SourceCategory;
import com.wikiaov.media.internal.source.persistence.entity.SourceCollection;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** Collections of source files. Only the declared methods exist; Spring Data implements them. */
public interface SourceCollectionRepository extends Repository<SourceCollection, UUID> {

    Optional<SourceCollection> findById(UUID id);

    Optional<SourceCollection> findByCode(String code);

    SourceCollection saveAndFlush(SourceCollection collection);

    void delete(SourceCollection collection);

    /**
     * Collections with their file count and the bytes of their files. A project keeps tens of collections, so the
     * caller sorts and pages them. {@code pattern} is a lower-case LIKE pattern on code and label.
     */
    @Query("""
            select c.id as id, c.code as code, c.category as category, c.label as label, c.note as note,
                   c.capturedOn as capturedOn, c.updatedAt as updatedAt, c.lockVersion as version,
                   count(f.id) as fileCount, coalesce(sum(o.sizeBytes), 0) as totalBytes
            from SourceCollection c
            left join SourceFile f on f.collectionId = c.id
            left join SourceObject o on o.sha256 = f.sha256
            where (:category is null or c.category = :category)
              and (lower(c.code) like :pattern escape '\\' or lower(c.label) like :pattern escape '\\')
            group by c.id, c.code, c.category, c.label, c.note, c.capturedOn, c.updatedAt, c.lockVersion
            """)
    List<CollectionRow> search(@Param("category") @Nullable SourceCategory category,
            @Param("pattern") String pattern);

    @Query("""
            select c.id as id, c.code as code, c.category as category, c.label as label, c.note as note,
                   c.capturedOn as capturedOn, c.updatedAt as updatedAt, c.lockVersion as version,
                   count(f.id) as fileCount, coalesce(sum(o.sizeBytes), 0) as totalBytes
            from SourceCollection c
            left join SourceFile f on f.collectionId = c.id
            left join SourceObject o on o.sha256 = f.sha256
            where c.id = :id
            group by c.id, c.code, c.category, c.label, c.note, c.capturedOn, c.updatedAt, c.lockVersion
            """)
    Optional<CollectionRow> findRow(@Param("id") UUID id);

    interface CollectionRow {
        UUID getId();

        String getCode();

        SourceCategory getCategory();

        String getLabel();

        @Nullable
        String getNote();

        @Nullable
        LocalDate getCapturedOn();

        Instant getUpdatedAt();

        long getVersion();

        long getFileCount();

        long getTotalBytes();
    }
}
