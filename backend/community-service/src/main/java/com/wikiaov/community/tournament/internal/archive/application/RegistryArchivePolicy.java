package com.wikiaov.community.tournament.internal.archive.application;

import com.wikiaov.community.platform.ApiException;
import com.wikiaov.community.tournament.internal.application.TournamentErrorCode;
import com.wikiaov.community.tournament.internal.application.TournamentErrors;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.*;
import com.wikiaov.community.tournament.internal.archive.domain.RegistryDependencies;
import com.wikiaov.community.tournament.internal.archive.domain.RegistryKind;
import com.wikiaov.community.tournament.internal.archive.persistence.RegistryUsageRepository;
import com.wikiaov.community.tournament.internal.archive.persistence.RegistryWriteGuard;
import com.wikiaov.community.tournament.internal.persistence.VersionedRecord;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class RegistryArchivePolicy {
    private final RegistryWriteGuard writes;
    private final RegistryUsageRepository usages;

    public RegistryArchivePolicy(RegistryWriteGuard writes, RegistryUsageRepository usages) {
        this.writes = writes;
        this.usages = usages;
    }

    public void lockWrites() {
        writes.acquire();
    }

    public Impact impact(RegistryKind kind, VersionedRecord row) {
        var references = usages.usages(kind.name(), row.getId()).stream().filter(usage -> usage.getCount() > 0)
                .map(usage -> new Usage(usage.getType(), usage.getCount(),
                        usagePath(usage.getType(), kind, row.getId())))
                .toList();
        return new Impact(row.getId(), row.getVersion(), row.getDeletedAt(),
                row.getDeletedAt() == null && references.isEmpty(), references);
    }

    public void mutate(RegistryKind kind, VersionedRecord row, Object content, Long version, Action action,
            String actor) {
        TournamentErrors.version(row.getVersion(), version);
        if (action == Action.DELETE) {
            requireActive(row);
            var impact = impact(kind, row);
            if (!impact.canDelete())
                throw new ApiException(TournamentErrorCode.TOURNAMENT_RECORD_IN_USE,
                        "This record is still used by editorial data or immutable published history.",
                        Map.of("usages", impact.usages()));
            row.delete(actor);
        } else {
            var missing = unavailableParents(content);
            if (!missing.isEmpty())
                throw new ApiException(TournamentErrorCode.TOURNAMENT_RESTORE_BLOCKED,
                        "Restore the required parent records before restoring this record.", Map.of("usages", missing));
            if (row.getDeletedAt() != null)
                row.restore(actor);
        }
    }

    public void validateParents(Object content) {
        var missing = unavailableParents(content);
        if (!missing.isEmpty())
            throw new ApiException(TournamentErrorCode.TOURNAMENT_RECORD_DELETED,
                    "Choose existing active parent records before saving.", Map.of("usages", missing));
    }

    public static void requireActive(VersionedRecord row) {
        if (row.getDeletedAt() != null)
            throw new ApiException(TournamentErrorCode.TOURNAMENT_RECORD_DELETED,
                    "This record is in the trash. Restore it before editing.");
    }

    public static State state(VersionedRecord row) {
        return new State(row.getId(), row.getVersion(), row.getDeletedAt());
    }

    private List<Usage> unavailableParents(Object content) {
        return RegistryDependencies.of(content).stream()
                .filter(parent -> usages.activeParents(parent.kind().name(), parent.id()) == 0)
                .map(parent -> new Usage(parent.kind().name(), 1, parentPath(parent.kind(), parent.id()))).toList();
    }

    private static String usagePath(String type, RegistryKind kind, UUID id) {
        if (type.equals("ROSTER_MEMBERSHIP") && kind == RegistryKind.TEAM)
            return "/tournaments?tab=teams&roster=" + id;
        if (type.equals("ROSTER_MEMBERSHIP") && kind == RegistryKind.PLAYER)
            return "/tournaments?tab=players&player=" + id;
        if (type.equals("SERIES") && kind == RegistryKind.TOURNAMENT)
            return "/tournaments?tournament=" + id;
        if (type.equals("GAME") && kind == RegistryKind.SERIES)
            return "/tournaments?series=" + id;
        return "/tournaments";
    }

    private static String parentPath(RegistryKind kind, UUID id) {
        return switch (kind) {
            case TEAM -> "/tournaments?tab=teams&team=" + id;
            case PLAYER -> "/tournaments?tab=players&player=" + id;
            case TOURNAMENT -> "/tournaments?tournament=" + id;
            case SERIES -> "/tournaments?series=" + id;
            default -> "/tournaments";
        };
    }
}
