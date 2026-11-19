package com.wikiaov.spell.internal.catalog.persistence;

import com.wikiaov.spell.internal.catalog.persistence.entity.SpellIdentity;
import com.wikiaov.video.VideoSubjectName;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface SpellIdentityRepository extends JpaRepository<SpellIdentity, UUID> {
    Optional<SpellIdentity> findByCode(String code);

    List<SpellIdentity> findByCodeIn(Collection<String> codes);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from SpellIdentity e where e.id=:id")
    Optional<SpellIdentity> lockById(UUID id);

    @Query("""
            select distinct new com.wikiaov.video.VideoSubjectName(
                e.id, e.code, t.locale, t.name, coalesce(r.revisionNo, 0L))
            from SpellIdentity e
            left join SpellRevision r on r.ownerId = e.id and r.state <> com.wikiaov.platform.RevisionState.DISCARDED
            left join SpellTranslation t on t.revisionId = r.id
            """)
    List<VideoSubjectName> videoSubjectNames();
}
