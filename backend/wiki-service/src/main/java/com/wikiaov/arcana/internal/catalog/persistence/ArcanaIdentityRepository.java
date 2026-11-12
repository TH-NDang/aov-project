package com.wikiaov.arcana.internal.catalog.persistence;

import com.wikiaov.arcana.internal.catalog.persistence.entity.ArcanaIdentity;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface ArcanaIdentityRepository extends JpaRepository<ArcanaIdentity, UUID> {
    Optional<ArcanaIdentity> findByCode(String code);

    List<ArcanaIdentity> findByCodeIn(Collection<String> codes);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from ArcanaIdentity e where e.id=:id")
    Optional<ArcanaIdentity> lockById(UUID id);

    @Query("""
            select distinct new com.wikiaov.video.VideoSubjectName(
                e.id, e.code, t.locale, t.name, coalesce(r.revisionNo, 0L))
            from ArcanaIdentity e
            left join ArcanaRevision r on r.ownerId = e.id and r.state <> 'DISCARDED'
            left join ArcanaTranslation t on t.revisionId = r.id
            """)
    java.util.List<com.wikiaov.video.VideoSubjectName> videoSubjectNames();
}
