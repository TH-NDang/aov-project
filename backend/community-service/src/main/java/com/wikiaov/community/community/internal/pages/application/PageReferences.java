package com.wikiaov.community.community.internal.pages.application;

import com.wikiaov.community.community.internal.domain.PageAuditAction;
import com.wikiaov.community.community.internal.domain.PageContent.Kind;
import com.wikiaov.community.community.internal.pages.persistence.PageAuditRepository;
import com.wikiaov.community.community.internal.pages.persistence.PageRecord;
import com.wikiaov.community.community.internal.pages.persistence.PageRepository;
import com.wikiaov.community.tournament.CompetitionReferences;
import com.wikiaov.community.tournament.CompetitionReferences.Subject;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class PageReferences implements CompetitionReferences {
    private final PageRepository pages;
    private final PageAuditRepository audits;

    public PageReferences(PageRepository pages, PageAuditRepository audits) {
        this.pages = pages;
        this.audits = audits;
    }

    /**
     * Team and player pages name the identity they stand for; nothing else is named by a page. The page counts only
     * while it keeps its identity out of the trash.
     */
    @Override
    public long identityReferences(Subject subject, UUID id) {
        var page = switch (subject) {
            case TEAM -> pages.findByKindAndEntityId(Kind.TEAM, id);
            case PLAYER -> pages.findByKindAndEntityId(Kind.PLAYER, id);
            default -> Optional.<PageRecord>empty();
        };
        return page.filter(this::keepsIdentity).isPresent() ? 1 : 0;
    }

    @Override
    public long mediaReferences(UUID id) {
        return pages.countMedia(id.toString());
    }

    @Override
    public List<String> allMediaReferences() {
        return pages.allMedia();
    }

    /**
     * A page keeps its identity once it was published, while it has representatives, requests or community activity,
     * and while a team that is not in the trash names it in its roster. An untouched draft is part of its identity
     * instead: it goes to the trash with it and comes back when the identity is restored.
     */
    private boolean keepsIdentity(PageRecord page) {
        return page.getPublishedContent() != null
                || audits.existsByPageIdAndAction(page.getId(), PageAuditAction.PAGE_PUBLISHED)
                || pages.countActivity(page.getId()) > 0
                || pages.countActiveRosterReferences(Kind.TEAM.name(), page.getId().toString()) > 0;
    }
}
