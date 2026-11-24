package com.wikiaov.community.tournament.internal.registry.application;

import com.wikiaov.community.platform.ApiException;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.internal.application.TournamentErrorCode;
import com.wikiaov.community.tournament.internal.application.TournamentErrors;
import com.wikiaov.community.tournament.internal.application.TournamentViews;
import com.wikiaov.community.tournament.internal.application.TournamentViews.View;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.Action;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.Impact;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.State;
import com.wikiaov.community.tournament.internal.archive.application.RegistryArchivePolicy;
import com.wikiaov.community.tournament.internal.archive.domain.RecordState;
import com.wikiaov.community.tournament.internal.archive.domain.RegistryKind;
import com.wikiaov.community.tournament.internal.domain.ReferenceLabels;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Player;
import com.wikiaov.community.tournament.internal.media.application.CompetitionMedia;
import com.wikiaov.community.tournament.internal.registry.persistence.PlayerRecord;
import com.wikiaov.community.tournament.internal.registry.persistence.PlayerRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

/** Runs inside the transaction of the facade that calls it. */
@Service
public class PlayerRegistry {
    private static final int MAX_SIGNATURE_HEROES = 20;
    private final RegistryArchivePolicy archives;
    private final CompetitionMedia media;
    private final PlayerRepository repository;

    public PlayerRegistry(PlayerRepository repository, RegistryArchivePolicy archives, CompetitionMedia media) {
        this.archives = archives;
        this.media = media;
        this.repository = repository;
    }

    public PageSlice<View<Player>> list(String q, RecordState state, Pageable page) {
        var unsorted = PageRequest.of(page.getPageNumber(), page.getPageSize());
        return PageSlice.from(repository.search(ReferenceLabels.literalSearch(q), state.name(), unsorted)
                .map(row -> TournamentViews.view(row, row.getContent())));
    }

    public View<Player> get(UUID id) {
        var row = repository.findById(id).orElseThrow(TournamentErrors::missing);
        return TournamentViews.view(row, row.getContent());
    }

    public View<Player> create(Player content, String actor, boolean allowSameName) {
        archives.lockWrites();
        validate(content);
        if (!allowSameName) {
            refuseSameName(content);
        }

        var row = repository.saveAndFlush(new PlayerRecord(UUID.randomUUID(), content, actor));
        return TournamentViews.view(row, row.getContent());
    }

    public View<Player> update(UUID id, Long version, Player content, String actor) {
        archives.lockWrites();
        validate(content);

        var row = repository.findById(id).orElseThrow(TournamentErrors::missing);
        RegistryArchivePolicy.requireActive(row);
        TournamentErrors.version(row.getVersion(), version);

        row.setContent(content, actor);
        repository.flush();

        return TournamentViews.view(row, row.getContent());
    }

    /**
     * Two profiles of one person split their games and rosters, so a new player whose nickname or alias reads like an
     * active player's of the same country is refused until the editor confirms a namesake (spec 04).
     */
    private void refuseSameName(Player content) {
        if (content.country() == null || content.country().isBlank()) {
            return;
        }

        var names = new ArrayList<String>();
        names.add(content.nickname());
        names.addAll(content.aliases());
        var found = new LinkedHashMap<UUID, PlayerRecord>();
        for (var name : names) {
            repository.findSameName(content.country(), name).forEach(row -> found.putIfAbsent(row.getId(), row));
        }
        if (found.isEmpty()) {
            return;
        }

        var players = found.values().stream().map(row -> Map.of("id", row.getId(), "code", row.getContent().code(),
                "nickname", row.getContent().nickname(), "country", row.getContent().country())).toList();
        throw new ApiException(TournamentErrorCode.TOURNAMENT_PLAYER_SAME_NAME,
                "An active player of this country already has this name. Use that profile, or confirm a namesake.",
                Map.of("players", players));
    }

    private void validate(Player content) {
        if (content == null) {
            throw TournamentErrors.invalid("content is required.");
        }
        TournamentErrors.code(content.code());
        TournamentErrors.required(content.nickname(), "nickname");
        if (content.signatureHeroes().size() > MAX_SIGNATURE_HEROES
                || content.signatureHeroes().stream()
                        .anyMatch(
                                name -> name == null || name.isBlank() || name.length() > ReferenceLabels.MAX_LABEL)) {
            throw TournamentErrors.invalid("signatureHeroes allows " + MAX_SIGNATURE_HEROES
                    + " names of at most " + ReferenceLabels.MAX_LABEL + " characters.");
        }
        if (!ReferenceLabels.validAliases(content.aliases())) {
            throw TournamentErrors
                    .invalid("Use at most " + ReferenceLabels.MAX_ALIASES + " unique player aliases of 1 to "
                            + ReferenceLabels.MAX_LABEL + " characters each.");
        }
    }

    public Impact deletionImpact(UUID id) {
        var row = repository.findById(id).orElseThrow(TournamentErrors::missing);
        return archives.impact(RegistryKind.PLAYER, row);
    }

    public State lifecycle(UUID id, Long version, Action action, String actor) {
        archives.lockWrites();
        var row = repository.findById(id).orElseThrow(TournamentErrors::missing);
        archives.mutate(RegistryKind.PLAYER, row, row.getContent(), version, action, actor);
        repository.flush();
        return RegistryArchivePolicy.state(row);
    }
}
