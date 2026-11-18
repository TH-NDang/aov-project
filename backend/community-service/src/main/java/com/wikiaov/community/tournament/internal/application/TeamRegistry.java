package com.wikiaov.community.tournament.internal.application;

import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.internal.application.TournamentViews.View;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.Action;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.Impact;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.State;
import com.wikiaov.community.tournament.internal.archive.application.RegistryArchivePolicy;
import com.wikiaov.community.tournament.internal.archive.domain.RecordState;
import com.wikiaov.community.tournament.internal.archive.domain.RegistryKind;
import com.wikiaov.community.tournament.internal.domain.ReferenceLabels;
import com.wikiaov.community.tournament.internal.domain.SourceUrls;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Team;
import com.wikiaov.community.tournament.internal.media.application.CompetitionMedia;
import com.wikiaov.community.tournament.internal.persistence.TeamRecord;
import com.wikiaov.community.tournament.internal.persistence.TeamRepository;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class TeamRegistry {
    private final RegistryArchivePolicy archives;
    private final CompetitionMedia media;
    private final TeamRepository repository;

    public TeamRegistry(TeamRepository repository, RegistryArchivePolicy archives, CompetitionMedia media) {
        this.archives = archives;
        this.media = media;
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public PageSlice<View<Team>> list(String q, RecordState state, Pageable page) {
        var unsorted = PageRequest.of(page.getPageNumber(), page.getPageSize());
        return PageSlice.from(repository.search(ReferenceLabels.literalSearch(q), state.name(), unsorted)
                .map(row -> TournamentViews.view(row, row.getContent())));
    }

    @Transactional(readOnly = true)
    public View<Team> get(UUID id) {
        var row = repository.findById(id).orElseThrow(TournamentErrors::missing);
        return TournamentViews.view(row, row.getContent());
    }

    public View<Team> create(Team content, String actor) {
        archives.lockWrites();
        validate(content);
        media.requireAvailable(content.logoUrl());

        var row = repository.saveAndFlush(new TeamRecord(UUID.randomUUID(), content, actor));
        return TournamentViews.view(row, row.getContent());
    }

    public View<Team> update(UUID id, Long version, Team content, String actor) {
        archives.lockWrites();
        validate(content);
        media.requireAvailable(content.logoUrl());

        var row = repository.findById(id).orElseThrow(TournamentErrors::missing);
        RegistryArchivePolicy.requireActive(row);
        TournamentErrors.version(row.getVersion(), version);

        row.setContent(content, actor);
        repository.flush();

        return TournamentViews.view(row, row.getContent());
    }

    private void validate(Team content) {
        if (content == null) {
            throw TournamentErrors.invalid("content is required.");
        }
        TournamentErrors.code(content.code());
        if (!SourceUrls.valid(content.logoUrl())) {
            throw TournamentErrors
                    .invalid("logoUrl must be an absolute HTTP or HTTPS URL without embedded credentials.");
        }
        TournamentErrors.required(content.name(), "name");
        validateAliases(content);
    }

    private static void validateAliases(Team content) {
        if (content.shortName() != null && content.shortName().length() > ReferenceLabels.MAX_LABEL) {
            throw TournamentErrors
                    .invalid("shortName must not exceed " + ReferenceLabels.MAX_LABEL + " characters.");
        }
        if (!ReferenceLabels.validAliases(content.aliases())) {
            throw TournamentErrors
                    .invalid("Use at most " + ReferenceLabels.MAX_ALIASES + " unique team aliases of 1 to "
                            + ReferenceLabels.MAX_LABEL + " characters each.");
        }
    }

    @Transactional(readOnly = true)
    public Impact deletionImpact(UUID id) {
        var row = repository.findById(id).orElseThrow(TournamentErrors::missing);
        return archives.impact(RegistryKind.TEAM, row);
    }

    public State lifecycle(UUID id, Long version, Action action, String actor) {
        archives.lockWrites();
        var row = repository.findById(id).orElseThrow(TournamentErrors::missing);
        archives.mutate(RegistryKind.TEAM, row, row.getContent(), version, action, actor);
        repository.flush();
        return RegistryArchivePolicy.state(row);
    }
}
