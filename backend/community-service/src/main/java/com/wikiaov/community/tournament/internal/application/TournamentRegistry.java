package com.wikiaov.community.tournament.internal.application;

import com.wikiaov.community.tournament.internal.application.TournamentViews.*;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.*;
import com.wikiaov.community.tournament.internal.archive.application.RegistryArchivePolicy;
import com.wikiaov.community.tournament.internal.archive.domain.RecordState;
import com.wikiaov.community.tournament.internal.archive.domain.RegistryKind;
import com.wikiaov.community.tournament.internal.domain.SourceUrls;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import com.wikiaov.community.tournament.internal.domain.TournamentMetadataRules;
import com.wikiaov.community.tournament.internal.persistence.*;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class TournamentRegistry {
    private final RegistryArchivePolicy archives;
    private final TournamentRepository repository;

    public TournamentRegistry(TournamentRepository repository, RegistryArchivePolicy archives) {
        this.archives = archives;
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public PageSlice<View<Tournament>> list(String q, RecordState state, Pageable page) {
        return PageSlice.from(repository.search(q, state.name(), page)
                .map(row -> TournamentViews.view(row, row.getContent())));
    }

    @Transactional(readOnly = true)
    public View<Tournament> get(UUID id) {
        var row = repository.findById(id).orElseThrow(TournamentErrors::missing);
        return TournamentViews.view(row, row.getContent());
    }

    public View<Tournament> create(Tournament content, String actor) {
        archives.lockWrites();
        validate(content);

        var row = repository.saveAndFlush(new TournamentRecord(UUID.randomUUID(), content, actor));
        return TournamentViews.view(row, row.getContent());
    }

    public View<Tournament> update(UUID id, Long version, Tournament content, String actor) {
        archives.lockWrites();
        validate(content);

        var row = repository.findById(id).orElseThrow(TournamentErrors::missing);
        RegistryArchivePolicy.requireActive(row);
        TournamentErrors.version(row.getVersion(), version);

        row.setContent(content, actor);
        repository.flush();

        return TournamentViews.view(row, row.getContent());
    }

    private void validate(Tournament content) {
        if (content == null)
            throw TournamentErrors.invalid("content is required.");
        TournamentErrors.code(content.code());
        if (!SourceUrls.valid(content.sourceUrl()))
            throw TournamentErrors
                    .invalid("sourceUrl must be an absolute HTTP or HTTPS URL without embedded credentials.");
        TournamentErrors.required(content.name(), "name");
        if (content.region() == null || content.region().isBlank())
            throw TournamentErrors.invalid("region is required.");
        if (content.startsOn() != null && content.endsOn() != null && content.endsOn().isBefore(content.startsOn()))
            throw TournamentErrors.invalid("endsOn cannot precede startsOn.");

        var violations = TournamentMetadataRules.violations(content);
        if (!violations.isEmpty())
            throw TournamentErrors.invalid(String.join(" ", violations));
    }

    @Transactional(readOnly = true)
    public Impact deletionImpact(UUID id) {
        var row = repository.findById(id).orElseThrow(TournamentErrors::missing);
        return archives.impact(RegistryKind.TOURNAMENT, row);
    }

    public State lifecycle(UUID id, Long version, Action action, String actor) {
        archives.lockWrites();
        var row = repository.findById(id).orElseThrow(TournamentErrors::missing);
        archives.mutate(RegistryKind.TOURNAMENT, row, row.getContent(), version, action, actor);
        repository.flush();
        return RegistryArchivePolicy.state(row);
    }
}
