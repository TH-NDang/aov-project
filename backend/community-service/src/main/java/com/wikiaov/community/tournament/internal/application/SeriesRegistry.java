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
    public PageSlice<View<Series>> list(String q, RecordState state, Pageable page) {
        return PageSlice.from(repository.search(q, state.name(), page)
                .map(row -> TournamentViews.view(row, row.getContent())));
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
        if (content.bestOf() == null || !java.util.Set.of(1, 3, 5, 7, 9).contains(content.bestOf()))
            throw TournamentErrors.invalid("bestOf must be an odd number between 1 and 9.");
        if (content.result() != null) {
            var result = content.result();
            int wins = content.bestOf() / 2 + 1;
            if (result.scoreA() == null || result.scoreB() == null || result.scoreA() < 0 || result.scoreB() < 0
                    || result.scoreA() > wins || result.scoreB() > wins
                    || result.scoreA().equals(result.scoreB())
                    || Math.max(result.scoreA(), result.scoreB()) != wins)
                throw TournamentErrors.invalid("A completed series requires one winner at the best-of threshold.");
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
