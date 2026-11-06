package com.wikiaov.community.community.internal.pages.application;

import com.wikiaov.community.community.internal.pages.persistence.PageRepository;
import com.wikiaov.community.tournament.CompetitionReferences;
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
    public long identityReferences(String kind, UUID id) {
        return pages.countByKindAndEntityId(kind, id);
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
