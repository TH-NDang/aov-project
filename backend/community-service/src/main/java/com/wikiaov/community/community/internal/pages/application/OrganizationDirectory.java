package com.wikiaov.community.community.internal.pages.application;

import com.wikiaov.community.community.internal.pages.persistence.PageRepository;
import com.wikiaov.community.tournament.CompetitionOrganizations;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class OrganizationDirectory implements CompetitionOrganizations {
    private final PageRepository pages;

    public OrganizationDirectory(PageRepository pages) {
        this.pages = pages;
    }

    @Override
    public Organization read(UUID pageId, boolean published) {
        var row = pages.findById(pageId)
                .filter(page -> "ORGANIZATION".equals(page.getKind()))
                .orElseThrow(() -> new IllegalArgumentException("Select an existing organization page."));
        var content = published ? row.getPublishedContent() : row.getContent();
        if (content == null) {
            throw new IllegalArgumentException("Publish the organization page before publishing the competition.");
        }

        return new Organization(row.getId(), row.getCode(), content.name(), content.avatarUrl(),
                row.getPublishedContent() != null);
    }
}
