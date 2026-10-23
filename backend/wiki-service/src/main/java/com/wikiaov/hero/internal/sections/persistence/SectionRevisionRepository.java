package com.wikiaov.hero.internal.sections.persistence;

import com.wikiaov.hero.internal.sections.persistence.entity.SectionRevision;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.NoRepositoryBean;

@NoRepositoryBean
public interface SectionRevisionRepository<T extends SectionRevision> extends JpaRepository<T, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from #{#entityName} r where r.id = :id")
    Optional<T> lockById(UUID id);
}
