package com.wikiaov.item.internal.catalog.persistence;

import com.wikiaov.item.internal.catalog.persistence.entity.ItemIdentity;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface ItemIdentityRepository extends JpaRepository<ItemIdentity, UUID> {
    Optional<ItemIdentity> findByCode(String code);

    List<ItemIdentity> findByCodeIn(Collection<String> codes);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from ItemIdentity e where e.id=:id")
    Optional<ItemIdentity> lockById(UUID id);

    @Query("""
            select distinct new com.wikiaov.video.VideoSubjectName(
                e.id, e.code, t.locale, t.name, coalesce(r.revisionNo, 0L))
            from ItemIdentity e
            left join ItemRevision r on r.ownerId = e.id and r.state <> com.wikiaov.platform.RevisionState.DISCARDED
            left join ItemTranslation t on t.revisionId = r.id
            """)
    java.util.List<com.wikiaov.video.VideoSubjectName> videoSubjectNames();
}
