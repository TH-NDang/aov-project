package com.wikiaov.community.tournament.internal.application;

import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.internal.application.TournamentViews.*;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.*;
import com.wikiaov.community.tournament.internal.archive.application.RegistryArchivePolicy;
import com.wikiaov.community.tournament.internal.archive.domain.RecordState;
import com.wikiaov.community.tournament.internal.archive.domain.RegistryKind;
import com.wikiaov.community.tournament.internal.domain.ReferenceLabels;
import com.wikiaov.community.tournament.internal.domain.SourceUrls;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Player;
import com.wikiaov.community.tournament.internal.media.application.CompetitionMedia;
import com.wikiaov.community.tournament.internal.persistence.*;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PlayerRegistry {
    private final RegistryArchivePolicy archives;
    private final CompetitionMedia media;
    private final PlayerRepository repository;

    public PlayerRegistry(PlayerRepository repository, RegistryArchivePolicy archives, CompetitionMedia media) {
        this.archives = archives;
        this.media = media;
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public PageSlice<View<Player>> list(String q, RecordState state, Pageable page) {
        var unsorted = PageRequest.of(page.getPageNumber(), page.getPageSize());
        return PageSlice.from(repository.search(ReferenceLabels.literalSearch(q), state.name(), unsorted)
                .map(row -> TournamentViews.view(row, row.getContent())));
    }

    @Transactional(readOnly = true)
    public View<Player> get(UUID id) {
        var row = repository.findById(id).orElseThrow(TournamentErrors::missing);
        return TournamentViews.view(row, row.getContent());
    }

    public View<Player> create(Player content, String actor) {
        archives.lockWrites();
        validate(content);
        media.requireAvailable(content.photoUrl());

        var row = repository.saveAndFlush(new PlayerRecord(UUID.randomUUID(), content, actor));
        return TournamentViews.view(row, row.getContent());
    }

    public View<Player> update(UUID id, Long version, Player content, String actor) {
        archives.lockWrites();
        validate(content);
        media.requireAvailable(content.photoUrl());

        var row = repository.findById(id).orElseThrow(TournamentErrors::missing);
        RegistryArchivePolicy.requireActive(row);
        TournamentErrors.version(row.getVersion(), version);

        row.setContent(content, actor);
        repository.flush();

        return TournamentViews.view(row, row.getContent());
    }

    private void validate(Player content) {
        if (content == null)
            throw TournamentErrors.invalid("content is required.");
        TournamentErrors.code(content.code());
        TournamentErrors.required(content.nickname(), "nickname");
        if (content.signatureHeroes().size() > 20
                || content.signatureHeroes().stream()
                        .anyMatch(name -> name == null || name.isBlank() || name.length() > 100))
            throw TournamentErrors.invalid("signatureHeroes allows 20 names of at most 100 characters.");
        if (!SourceUrls.valid(content.photoUrl()))
            throw TournamentErrors
                    .invalid("photoUrl must be an absolute HTTP or HTTPS URL without embedded credentials.");
        if (!ReferenceLabels.validAliases(content.aliases()))
            throw TournamentErrors.invalid("Use at most 20 unique player aliases of 1 to 100 characters each.");
    }

    @Transactional(readOnly = true)
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
