package com.wikiaov.enchantment.internal.catalog.persistence;

import com.wikiaov.enchantment.internal.catalog.persistence.entity.EnchantmentIdentity;
import com.wikiaov.video.VideoSubjectName;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface EnchantmentIdentityRepository extends JpaRepository<EnchantmentIdentity, UUID> {
    Optional<EnchantmentIdentity> findByCode(String code);

    List<EnchantmentIdentity> findByCodeIn(Collection<String> codes);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from EnchantmentIdentity e where e.id=:id")
    Optional<EnchantmentIdentity> lockById(UUID id);

    @Query("""
            select distinct new com.wikiaov.video.VideoSubjectName(
                e.id, e.code, t.locale, t.name, coalesce(r.revisionNo, 0L))
            from EnchantmentIdentity e
            left join EnchantmentRevision r on r.ownerId = e.id and r.state <> com.wikiaov.platform.RevisionState.DISCARDED
            left join EnchantmentTranslation t on t.revisionId = r.id
            """)
    List<VideoSubjectName> videoSubjectNames();
}
