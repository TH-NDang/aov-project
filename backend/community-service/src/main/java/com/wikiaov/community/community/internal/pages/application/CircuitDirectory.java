package com.wikiaov.community.community.internal.pages.application;

import com.wikiaov.community.community.internal.pages.persistence.PageRepository;
import com.wikiaov.community.tournament.CompetitionCircuits;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class CircuitDirectory implements CompetitionCircuits {
    private final PageRepository pages;

    public CircuitDirectory(PageRepository pages) {
        this.pages = pages;
    }

    @Override
    public Circuit read(UUID pageId, boolean published) {
        var row = pages.findById(pageId).filter(page -> "CIRCUIT".equals(page.getKind()))
                .orElseThrow(() -> new IllegalArgumentException("Select an existing circuit page."));
        var content = published ? row.getPublishedContent() : row.getContent();
        if (content == null)
            throw new IllegalArgumentException("Publish the circuit page before publishing the competition.");

        return new Circuit(row.getId(), row.getCode(), content.name(), content.avatarUrl(),
                row.getPublishedContent() != null);
    }
}
