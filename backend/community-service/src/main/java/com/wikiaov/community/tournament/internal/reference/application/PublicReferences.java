package com.wikiaov.community.tournament.internal.reference.application;

import com.wikiaov.community.tournament.CompetitionPages;
import com.wikiaov.community.tournament.internal.application.TournamentErrors;
import com.wikiaov.community.tournament.internal.reference.application.ReferenceViews.Names;
import com.wikiaov.community.tournament.internal.reference.application.ReferenceViews.Preview;
import com.wikiaov.community.tournament.internal.reference.domain.ReferenceKind;
import com.wikiaov.community.tournament.internal.reference.persistence.PublishedCompetitions;
import java.util.Collection;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/**
 * What a text can name, for readers: circuits and organizations with a published page, published competitions, and the
 * teams, players and personnel of either. Reading it all unpacks every published snapshot, so the last reading is kept
 * until a publication or withdrawal changes the revision, which two cheap queries tell on each request.
 */
@Service
public class PublicReferences {
    private final PublishedCompetitions competitions;
    private final CompetitionPages pages;
    private final Object reading = new Object();
    private volatile @Nullable Reading last;

    public PublicReferences(PublishedCompetitions competitions, CompetitionPages pages) {
        this.competitions = competitions;
        this.pages = pages;
    }

    /** Identifies the answers now: the same revision means the same names and previews. */
    @Transactional(readOnly = true)
    public String revision() {
        return competitions.revision() + pages.revision();
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Names names(Collection<ReferenceKind> kinds) {
        return new Names(book().names(kinds));
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Preview preview(ReferenceKind kind, UUID id) {
        var preview = book().preview(kind, id);
        if (preview == null) {
            throw TournamentErrors.missing();
        }

        return preview;
    }

    private ReferenceBook book() {
        var revision = revision();
        var kept = last;
        if (kept != null && kept.revision.equals(revision)) {
            return kept.book;
        }

        // Requests that arrive during a reading wait for it instead of unpacking every snapshot once more each.
        synchronized (reading) {
            kept = last;
            if (kept == null || !kept.revision.equals(revision)) {
                kept = new Reading(revision, read());
                last = kept;
            }
            return kept.book;
        }
    }

    private ReferenceBook read() {
        var published = competitions.named();
        var personnel = published.stream().flatMap(one -> one.people().keySet().stream())
                .collect(Collectors.toSet());

        return ReferenceBook.of(published, pages.published(), pages.players(personnel));
    }

    private record Reading(
            String revision,
            ReferenceBook book
    ) {
    }
}
