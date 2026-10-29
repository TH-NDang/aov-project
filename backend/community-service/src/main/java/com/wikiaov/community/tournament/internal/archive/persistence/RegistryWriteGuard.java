package com.wikiaov.community.tournament.internal.archive.persistence;

import com.wikiaov.community.tournament.internal.persistence.TeamRecord;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

/** Serialize short editorial mutations so JSON references and recoverable deletion share one database fence. */
public interface RegistryWriteGuard extends Repository<TeamRecord, UUID> {
    @Query(value = "SELECT 1 FROM pg_advisory_xact_lock(173535037,1)", nativeQuery = true)
    int acquire();
}
