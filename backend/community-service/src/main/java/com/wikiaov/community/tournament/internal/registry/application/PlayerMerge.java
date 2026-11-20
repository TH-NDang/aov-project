package com.wikiaov.community.tournament.internal.registry.application;

import com.wikiaov.community.platform.ApiException;
import com.wikiaov.community.tournament.internal.application.TournamentErrorCode;
import com.wikiaov.community.tournament.internal.application.TournamentErrors;
import com.wikiaov.community.tournament.internal.application.TournamentViews;
import com.wikiaov.community.tournament.internal.application.TournamentViews.View;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.Action;
import com.wikiaov.community.tournament.internal.archive.application.RegistryArchivePolicy;
import com.wikiaov.community.tournament.internal.archive.domain.RegistryKind;
import com.wikiaov.community.tournament.internal.domain.ReferenceLabels;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.CareerStatus;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Player;
import com.wikiaov.community.tournament.internal.registry.persistence.PlayerRecord;
import com.wikiaov.community.tournament.internal.registry.persistence.PlayerReferenceRewrites;
import com.wikiaov.community.tournament.internal.registry.persistence.PlayerReferenceRewrites.Moved;
import com.wikiaov.community.tournament.internal.registry.persistence.PlayerRepository;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Folds a second profile of one person into the profile that stays (spec 04, merging players): its roster lines,
 * seats, MVPs and awards move over, its names become aliases, and the second profile goes to the trash. Runs inside the
 * transaction of the facade that calls it, so a refused step leaves both profiles as they were.
 */
@Service
public class PlayerMerge {
    public record Result(
            View<Player> player,
            Moved moved
    ) {
    }

    private final RegistryArchivePolicy archives;
    private final PlayerRepository repository;
    private final PlayerReferenceRewrites rewrites;

    public PlayerMerge(RegistryArchivePolicy archives, PlayerRepository repository, PlayerReferenceRewrites rewrites) {
        this.archives = archives;
        this.repository = repository;
        this.rewrites = rewrites;
    }

    public Result merge(UUID sourceId, Long sourceVersion, UUID targetId, Long targetVersion, String actor) {
        archives.lockWrites();
        if (targetId == null || sourceId.equals(targetId)) {
            throw TournamentErrors.invalid("Choose another player to merge into.");
        }

        var source = active(sourceId, sourceVersion);
        var target = active(targetId, targetVersion);
        if (rewrites.sharedGames(sourceId, targetId) > 0) {
            throw TournamentErrors.invalid("Both players took a seat in the same game, so they are two people.");
        }
        if (rewrites.publishedReferences(sourceId) > 0) {
            throw new ApiException(TournamentErrorCode.TOURNAMENT_RECORD_IN_USE,
                    "Published games or plans name this player and never change, so it cannot be merged away.");
        }

        var combined = combine(target.getContent(), source.getContent());
        var moved = rewrites.move(sourceId, targetId, actor);

        var kept = repository.findById(targetId).orElseThrow(TournamentErrors::missing);
        kept.setContent(combined, actor);
        var merged = repository.findById(sourceId).orElseThrow(TournamentErrors::missing);
        archives.mutate(RegistryKind.PLAYER, merged, merged.getContent(), merged.getVersion(), Action.DELETE, actor);
        repository.flush();

        return new Result(TournamentViews.view(kept, kept.getContent()), moved);
    }

    private PlayerRecord active(UUID id, Long version) {
        var row = repository.findById(id).orElseThrow(TournamentErrors::missing);
        RegistryArchivePolicy.requireActive(row);
        TournamentErrors.version(row.getVersion(), version);
        return row;
    }

    /** The kept profile wins; the merged one only fills what the kept one left empty and adds its names. */
    static Player combine(Player kept, Player merged) {
        var aliases = new ArrayList<String>();
        var seen = new HashSet<String>();
        seen.add(kept.nickname().toLowerCase(Locale.ROOT));
        for (var name : concat(kept.aliases(), List.of(merged.nickname()), merged.aliases())) {
            if (aliases.size() < ReferenceLabels.MAX_ALIASES && name.length() <= ReferenceLabels.MAX_LABEL
                    && seen.add(name.toLowerCase(Locale.ROOT))) {
                aliases.add(name);
            }
        }

        return new Player(kept.code(), kept.nickname(), either(kept.fullName(), merged.fullName()), kept.country(),
                either(kept.photoUrl(), merged.photoUrl()), aliases, either(kept.birthDate(), merged.birthDate()),
                either(kept.lane(), merged.lane()),
                kept.careerStatus() == CareerStatus.UNKNOWN ? merged.careerStatus() : kept.careerStatus(),
                kept.signatureHeroes().isEmpty() ? merged.signatureHeroes() : kept.signatureHeroes());
    }

    @SafeVarargs
    private static List<String> concat(List<String>... lists) {
        var all = new ArrayList<String>();
        for (var list : lists) {
            all.addAll(list);
        }
        return all;
    }

    private static <T> T either(T kept, T merged) {
        return kept != null ? kept : merged;
    }
}
