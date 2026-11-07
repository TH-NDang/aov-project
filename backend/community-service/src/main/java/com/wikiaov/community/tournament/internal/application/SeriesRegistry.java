package com.wikiaov.community.tournament.internal.application;

import com.wikiaov.community.tournament.internal.application.TournamentViews.*;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.*;
import com.wikiaov.community.tournament.internal.archive.application.RegistryArchivePolicy;
import com.wikiaov.community.tournament.internal.archive.domain.RecordState;
import com.wikiaov.community.tournament.internal.archive.domain.RegistryKind;
import com.wikiaov.community.tournament.internal.domain.SourceUrls;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.persistence.*;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SeriesRegistry {
    private final RegistryArchivePolicy archives;
    private final SeriesRepository repository;
    private final TeamRepository teams;
    private final TournamentRepository tournaments;

    public SeriesRegistry(SeriesRepository repository, TeamRepository teams, TournamentRepository tournaments,
            RegistryArchivePolicy archives) {
        this.archives = archives;
        this.repository = repository;
        this.teams = teams;
        this.tournaments = tournaments;
    }

    @Transactional(readOnly = true)
    public PageSlice<View<Series>> list(String q, UUID tournamentId, RecordState state, Pageable page) {
        var unsorted = PageRequest.of(page.getPageNumber(), page.getPageSize());

        return PageSlice.from(repository.search(q, tournamentId == null ? "" : tournamentId.toString(), state.name(),
                unsorted).map(row -> TournamentViews.view(row, row.getContent())));
    }

    @Transactional(readOnly = true)
    public java.util.List<TournamentStats> stats() {
        return repository.stats().stream()
                .map(row -> new TournamentStats(row.getTournamentId(), row.getTeams(), row.getMatches(),
                        row.getPlayed()))
                .toList();
    }

    @Transactional(readOnly = true)
    public View<Series> get(UUID id) {
        var row = repository.findById(id).orElseThrow(TournamentErrors::missing);
        return TournamentViews.view(row, row.getContent());
    }

    public View<Series> create(Series content, String actor) {
        archives.lockWrites();
        validate(content);

        var row = repository.saveAndFlush(new SeriesRecord(UUID.randomUUID(), content, actor));
        return TournamentViews.view(row, row.getContent());
    }

    public View<Series> update(UUID id, Long version, Series content, String actor) {
        archives.lockWrites();
        validate(content);

        var row = repository.findById(id).orElseThrow(TournamentErrors::missing);
        RegistryArchivePolicy.requireActive(row);
        TournamentErrors.version(row.getVersion(), version);

        row.setContent(content, actor);
        repository.flush();

        return TournamentViews.view(row, row.getContent());
    }

    private void validate(Series content) {
        if (content == null)
            throw TournamentErrors.invalid("content is required.");
        TournamentErrors.code(content.code());
        if (!SourceUrls.valid(content.sourceUrl()))
            throw TournamentErrors
                    .invalid("sourceUrl must be an absolute HTTP or HTTPS URL without embedded credentials.");
        if (content.tournamentId() == null || !tournaments.existsById(content.tournamentId()))
            throw TournamentErrors.invalid("Choose an existing tournament.");
        if (content.teamAId() == null || content.teamBId() == null || content.teamAId().equals(content.teamBId())
                || !teams.existsById(content.teamAId()) || !teams.existsById(content.teamBId()))
            throw TournamentErrors.invalid("Choose two different existing teams.");
        if (content.bestOf() == null || !java.util.Set.of(1, 2, 3, 4, 5, 7, 9).contains(content.bestOf()))
            throw TournamentErrors.invalid("bestOf must be 1, 2, 3, 4, 5, 7 or 9.");
        if (content.result() != null) {
            var result = content.result();
            if (result.scoreA() == null || result.scoreB() == null || result.scoreA() < 0 || result.scoreB() < 0)
                throw TournamentErrors.invalid("A completed series requires both scores.");
            if (content.bestOf() % 2 == 0) {
                // A fixed-length series plays every game, so it may end level.
                if (result.scoreA() + result.scoreB() != content.bestOf())
                    throw TournamentErrors.invalid("A fixed-length series requires every game to be scored.");
            } else {
                int wins = content.bestOf() / 2 + 1;
                if (result.scoreA() > wins || result.scoreB() > wins || result.scoreA().equals(result.scoreB())
                        || Math.max(result.scoreA(), result.scoreB()) != wins)
                    throw TournamentErrors.invalid("A completed series requires one winner at the best-of threshold.");
            }
            if (result.sourceUrl() == null || result.sourceUrl().isBlank() || !SourceUrls.valid(result.sourceUrl()))
                throw TournamentErrors.invalid("Series result requires an absolute HTTP or HTTPS source URL.");
        }

        archives.validateParents(content);
    }

    @Transactional(readOnly = true)
    public Impact deletionImpact(UUID id) {
        var row = repository.findById(id).orElseThrow(TournamentErrors::missing);
        return archives.impact(RegistryKind.SERIES, row);
    }

    public State lifecycle(UUID id, Long version, Action action, String actor) {
        archives.lockWrites();
        var row = repository.findById(id).orElseThrow(TournamentErrors::missing);
        archives.mutate(RegistryKind.SERIES, row, row.getContent(), version, action, actor);
        repository.flush();
        return RegistryArchivePolicy.state(row);
    }
}
