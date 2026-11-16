package com.wikiaov.media.internal.source.persistence;

import com.wikiaov.media.internal.source.persistence.entity.SourceObject;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** Stored source bytes. Only the declared methods exist; Spring Data implements them. */
public interface SourceObjectRepository extends Repository<SourceObject, String> {

    Optional<SourceObject> findById(String sha256);

    List<SourceObject> findBySha256In(Collection<String> sha256s);

    /** Serializes placing a file on these bytes with purging them (02, ADR-030 section). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from SourceObject o where o.sha256 = :sha256")
    Optional<SourceObject> lockById(@Param("sha256") String sha256);

    /** Two uploads of the same bytes may finish together; the second insert is a no-op. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            INSERT INTO media.source_object (sha256, object_key, storage_alias, size_bytes, content_type, first_path,
                state, created_at, created_by_issuer, created_by_subject)
            VALUES (:sha256, :objectKey, :storageAlias, :sizeBytes, :contentType, :firstPath, 'READY', :createdAt,
                :issuer, :subject)
            ON CONFLICT (sha256) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(@Param("sha256") String sha256, @Param("objectKey") String objectKey,
            @Param("storageAlias") String storageAlias, @Param("sizeBytes") long sizeBytes,
            @Param("contentType") String contentType, @Param("firstPath") String firstPath,
            @Param("createdAt") Instant createdAt, @Param("issuer") String issuer, @Param("subject") String subject);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "DELETE FROM media.source_object WHERE sha256 = :sha256 AND state = 'DELETING'", nativeQuery = true)
    int deleteDeleting(@Param("sha256") String sha256);

    /** Bytes that no collection places any more, newest first; usages of other modules are checked by the caller. */
    @Query(value = """
            SELECT o.* FROM media.source_object o
            WHERE NOT EXISTS (SELECT 1 FROM media.source_file f WHERE f.sha256 = o.sha256)
            ORDER BY o.created_at DESC, o.sha256
            """, nativeQuery = true)
    List<SourceObject> findUnplaced();

    @Query(value = "SELECT count(*) AS files, coalesce(sum(size_bytes), 0) AS bytes FROM media.source_object", nativeQuery = true)
    Total total();

    /** Bytes per category of the collections that place them; bytes in two categories count in both. */
    @Query(value = """
            SELECT x.category AS key, count(*) AS files, coalesce(sum(o.size_bytes), 0) AS bytes
            FROM (SELECT DISTINCT c.category, f.sha256
                  FROM media.source_file f JOIN media.source_collection c ON c.id = f.collection_id) x
            JOIN media.source_object o ON o.sha256 = x.sha256
            GROUP BY x.category
            """, nativeQuery = true)
    List<GroupTotal> totalsByCategory();

    @Query(value = """
            SELECT to_char(date_trunc('month', created_at AT TIME ZONE 'UTC'), 'YYYY-MM') AS month,
                   count(*) AS files, coalesce(sum(size_bytes), 0) AS bytes
            FROM media.source_object
            WHERE created_at >= :from
            GROUP BY 1
            """, nativeQuery = true)
    List<MonthTotal> totalsByMonth(@Param("from") Instant from);

    @Query("select o.sha256 from SourceObject o where o.sha256 in :sha256s")
    List<String> findStoredSha256In(@Param("sha256s") Collection<String> sha256s);

    void delete(SourceObject object);

    interface Total {
        long getFiles();

        long getBytes();
    }

    interface GroupTotal {
        String getKey();

        long getFiles();

        long getBytes();
    }

    interface MonthTotal {
        String getMonth();

        long getFiles();

        long getBytes();
    }
}
