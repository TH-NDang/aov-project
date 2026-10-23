package com.wikiaov.hero.internal.alias.persistence;

import com.wikiaov.hero.internal.alias.persistence.entity.IdentifierNamespace;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

public interface IdentifierNamespaceRepository extends Repository<IdentifierNamespace, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select n from IdentifierNamespace n where n.name = :name")
    Optional<IdentifierNamespace> lock(String name);
}
