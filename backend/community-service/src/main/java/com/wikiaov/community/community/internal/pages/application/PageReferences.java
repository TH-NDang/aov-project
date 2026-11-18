package com.wikiaov.community.community.internal.pages.application;

import com.wikiaov.community.community.internal.domain.PageContent.Kind;
import com.wikiaov.community.community.internal.pages.persistence.PageRepository;
import com.wikiaov.community.tournament.CompetitionReferences;
import com.wikiaov.community.tournament.CompetitionReferences.Subject;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class PageReferences implements CompetitionReferences {
    private final PageRepository pages;

    public PageReferences(PageRepository pages) {
        this.pages = pages;
    }

    @Override
    /** Team and player pages name the identity they stand for; nothing else is named by a page. */
    public long identityReferences(Subject subject, UUID id) {
        return switch (subject) {
            case TEAM -> pages.countByKindAndEntityId(Kind.TEAM, id);
            case PLAYER -> pages.countByKindAndEntityId(Kind.PLAYER, id);
            default -> 0;
        };
    }

    @Override
    public long mediaReferences(UUID id) {
        return pages.countMedia(id.toString());
    }

    @Override
    public List<String> allMediaReferences() {
        return pages.allMedia();
    }
}
