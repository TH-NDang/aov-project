package com.wikiaov.community.community.internal.pages.application;

import com.wikiaov.community.community.internal.domain.PageContent;
import com.wikiaov.community.community.internal.pages.persistence.PageRepository;
import com.wikiaov.community.community.internal.pages.persistence.PageRepository.EntityRow;
import com.wikiaov.community.community.internal.pages.persistence.PageRepository.NamedRow;
import com.wikiaov.community.tournament.CompetitionPages;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/** The published pages as texts name them. */
@Component
public class PageNames implements CompetitionPages {
    private final PageRepository pages;

    public PageNames(PageRepository pages) {
        this.pages = pages;
    }

    @Override
    public List<NamedPage> published() {
        return pages.named(PageContent.Kind.CIRCUIT.name()).stream().map(PageNames::page).toList();
    }

    @Override
    public Map<UUID, UUID> players(Collection<UUID> pageIds) {
        if (pageIds.isEmpty()) {
            return Map.of();
        }

        return pages.playersBehind(pageIds).stream()
                .collect(Collectors.toMap(EntityRow::getId, EntityRow::getEntityId));
    }

    @Override
    public String revision() {
        return pages.namedRevision();
    }

    private static NamedPage page(NamedRow row) {
        var kind = Kind.valueOf(row.getKind());
        var individual = kind == Kind.PLAYER || kind == Kind.PERSON;

        return new NamedPage(row.getId(), kind, row.getCode(), row.getEntityId(), row.getName(), row.getShortName(),
                row.getCountry(), individual ? null : row.getLogoUrl(),
                individual ? null : firstParagraph(row.getSummary()));
    }

    private static @Nullable String firstParagraph(@Nullable String text) {
        if (text == null || text.isBlank()) {
            return null;
        }

        return text.strip().split("\\R\\s*\\R", 2)[0].strip();
    }
}
