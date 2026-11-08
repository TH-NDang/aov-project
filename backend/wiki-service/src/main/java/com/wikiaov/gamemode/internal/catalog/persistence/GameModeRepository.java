package com.wikiaov.gamemode.internal.catalog.persistence;

import com.wikiaov.gamemode.internal.catalog.persistence.entity.GameMode;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface GameModeRepository extends JpaRepository<GameMode, UUID> {
    Optional<GameMode> findByCode(String code);

    /** Serialises every write to one mode: its revisions, guide revisions and lineups. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from GameMode m where m.id = :id")
    Optional<GameMode> lockById(UUID id);
}
