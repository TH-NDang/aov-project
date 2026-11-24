package com.wikiaov.community.community.internal.pages.application;

import com.wikiaov.community.community.internal.domain.PageContent.Kind;
import com.wikiaov.community.community.internal.pages.persistence.PageRepository;
import com.wikiaov.community.tournament.CompetitionCircuits;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

@Component
public class CircuitDirectory implements CompetitionCircuits {
    private final PageRepository pages;

    public CircuitDirectory(PageRepository pages) {
        this.pages = pages;
    }

    @Override
    public Circuit read(UUID pageId, boolean published) {
        var row = pages.findById(pageId).filter(page -> page.getKind() == Kind.CIRCUIT)
                .orElseThrow(() -> new IllegalArgumentException("Select an existing circuit page."));
        var content = published ? row.getPublishedContent() : row.getContent();
        if (content == null) {
            throw new IllegalArgumentException("Publish the circuit page before publishing the competition.");
        }

        return new Circuit(row.getId(), row.getCode(), content.name(), content.avatarUrl(),
                row.getPublishedContent() != null);
    }

    @Override
    public Map<UUID, About> about(Collection<UUID> pageIds) {
        if (pageIds.isEmpty()) {
            return Map.of();
        }

        var about = new HashMap<UUID, About>();
        for (var row : pages.findAllById(pageIds)) {
            var content = row.getPublishedContent();
            if (row.getKind() == Kind.CIRCUIT && content != null) {
                about.put(row.getId(), new About(content.shortName(), firstParagraph(content.biography())));
            }
        }

        return about;
    }

    private static @Nullable String firstParagraph(@Nullable String text) {
        if (text == null || text.isBlank()) {
            return null;
        }

        return text.strip().split("\\R\\s*\\R", 2)[0].strip();
    }
}
