package com.wikiaov.community.community.internal.pages.application;

import com.wikiaov.community.community.internal.application.PageChecks;
import com.wikiaov.community.community.internal.domain.PageContent;
import com.wikiaov.community.community.internal.domain.PageContent.Kind;
import com.wikiaov.community.community.internal.pages.persistence.PageRepository;
import com.wikiaov.community.tournament.CompetitionTournaments;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Checks the records a page names besides its roster and channel: the tournaments of its history and achievements, the
 * pages its history relates to and the organization that owns a team (spec 04, ADR-032).
 */
@Component
public class PageLinks {
    private final PageRepository pages;
    private final CompetitionTournaments tournaments;

    public PageLinks(PageRepository pages, CompetitionTournaments tournaments) {
        this.pages = pages;
        this.tournaments = tournaments;
    }

    public void validate(Kind kind, PageContent content) {
        requireTournaments(content);
        requireRelatedPages(content);
        requireOrganization(kind, content, false);
    }

    /** A team is published only once the organization that owns it is. */
    public void validatePublication(Kind kind, PageContent content) {
        requireOrganization(kind, content, true);
    }

    private void requireTournaments(PageContent content) {
        var ids = new LinkedHashSet<UUID>();
        content.history().stream().map(PageContent.History::tournamentId).filter(Objects::nonNull).forEach(ids::add);
        content.achievements().stream().map(PageContent.Achievement::tournamentId).filter(Objects::nonNull)
                .forEach(ids::add);
        if (!ids.isEmpty() && !tournaments.known(ids).containsAll(ids)) {
            throw PageChecks.invalid("History and achievements must name existing tournaments.");
        }
    }

    private void requireRelatedPages(PageContent content) {
        var ids = content.history().stream().map(PageContent.History::relatedPageId).filter(Objects::nonNull)
                .distinct().toList();
        if (!ids.isEmpty() && pages.findAllById(ids).size() != ids.size()) {
            throw PageChecks.invalid("History must relate to existing pages.");
        }
    }

    private void requireOrganization(Kind kind, PageContent content, boolean publish) {
        if (content.organizationId() == null) {
            return;
        }
        if (kind != Kind.TEAM) {
            throw PageChecks.invalid("Only teams name an owning organization.");
        }

        var organization = pages.lock(content.organizationId())
                .orElseThrow(() -> PageChecks.invalid("The owning organization does not exist."));
        if (organization.getKind() != Kind.ORGANIZATION) {
            throw PageChecks.invalid("A team's owner must be an organization.");
        }
        if (publish && organization.getPublishedContent() == null) {
            throw PageAccess.conflict("Publish the owning organization before publishing the team.");
        }
    }
}
