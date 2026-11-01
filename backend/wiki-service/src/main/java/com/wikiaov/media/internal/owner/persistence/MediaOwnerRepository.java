package com.wikiaov.media.internal.owner.persistence;

import com.wikiaov.media.internal.owner.persistence.entity.MediaOwner;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

/** Spring Data repository for the owner catalog. Only the declared methods exist. */
public interface MediaOwnerRepository extends Repository<MediaOwner, UUID> {

    Optional<MediaOwner> findById(UUID id);

    Optional<MediaOwner> findByNameKey(String nameKey);

    /** Saves and flushes, so the new optimistic lock value is known and conflicts surface immediately. */
    MediaOwner saveAndFlush(MediaOwner owner);

    void delete(MediaOwner owner);

    /**
     * Creates the owner unless one with the key exists. PostgreSQL's {@code on conflict} keeps two concurrent first
     * uses of a name from failing the transaction.
     */
    @Modifying(flushAutomatically = true)
    @Query(value = """
            insert into media.media_owner (id, name, name_key, contact_url, lock_version, created_at, updated_at)
            values (:id, :name, :nameKey, null, 0, :now, :now)
            on conflict (name_key) do nothing
            """, nativeQuery = true)
    int insertIfAbsent(UUID id, String name, String nameKey, Instant now);

    /** Owners whose key contains the pattern, most used first. */
    @Query(value = """
            select o.id as id, o.name as name, o.contactUrl as contactUrl, o.lockVersion as lockVersion,
                   count(distinct p.assetId) as assetCount
            from MediaOwner o left join MediaProvenance p on p.ownerId = o.id
            where o.nameKey like :pattern escape '\\'
            group by o.id, o.name, o.contactUrl, o.lockVersion
            order by count(distinct p.assetId) desc, o.name asc, o.id asc
            """, countQuery = "select count(o) from MediaOwner o where o.nameKey like :pattern escape '\\'")
    Page<OwnerRow> search(String pattern, Pageable pageable);

    @Query("select count(distinct p.assetId) from MediaProvenance p where p.ownerId = :ownerId")
    long countAssets(UUID ownerId);

    interface OwnerRow {
        UUID getId();

        String getName();

        @Nullable
        String getContactUrl();

        long getLockVersion();

        long getAssetCount();
    }
}
