package com.wikiaov.community.tournament.internal.reference.application;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.internal.application.TournamentErrors;
import com.wikiaov.community.tournament.internal.domain.ReferenceLabels;
import com.wikiaov.community.tournament.internal.reference.persistence.EditorReferenceSearch;
import com.wikiaov.community.tournament.internal.reference.persistence.EditorReferenceSearch.ReferenceRow;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Service
public class EditorReferences {
    /** Most saved ids one lookup resolves. */
    private static final int MAX_IDS = 50;
    private final EditorReferenceSearch references;
    private final JsonMapper json;

    public EditorReferences(EditorReferenceSearch references, JsonMapper json) {
        this.references = references;
        this.json = json;
    }

    public enum Kind {
        TEAM,
        PLAYER
    }

    public record Translation(
            String locale,
            String name,
            List<String> aliases,
            String description
    ) {
    }

    public record Destinations(
            String admin
    ) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Entry(
            String id,
            String kind,
            List<Translation> translations,
            String icon,
            boolean autoMatch,
            Destinations destinations
    ) {
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public PageSlice<Entry> search(String query, Kind kind, List<UUID> ids, Pageable page) {
        if (ids != null && (ids.isEmpty() || ids.size() > MAX_IDS || ids.stream().anyMatch(Objects::isNull))) {
            throw TournamentErrors.invalid("Reference lookup accepts between 1 and " + MAX_IDS + " UUIDs.");
        }

        String escaped = ReferenceLabels.literalSearch(query);
        var unsorted = PageRequest.of(page.getPageNumber(), page.getPageSize());
        boolean teams = kind == null || kind == Kind.TEAM;
        boolean players = kind == null || kind == Kind.PLAYER;
        var rows = ids == null
                ? references.ranked(escaped, query, teams, players, unsorted)
                : references.byIds(escaped, teams, players, ids.stream().distinct().toList(), unsorted);

        return PageSlice.from(rows.map(this::entry));
    }

    private Entry entry(ReferenceRow row) {
        var aliases = new LinkedHashSet<String>();
        aliases.add(row.code());
        if (row.shortName() != null && !row.shortName().isBlank()) {
            aliases.add(row.shortName());
        }
        if (row.aliasesJson() != null && !row.aliasesJson().equals("null")) {
            aliases.addAll(json.readValue(row.aliasesJson(), new TypeReference<List<String>>() {
            }));
        }
        aliases.remove(row.name());
        var translation = new Translation("vi-VN", row.name(), List.copyOf(aliases), "");
        var kind = Kind.valueOf(row.kind());
        // The answer names the kind in lower case, as the editor links and reference ids expect.
        String name = kind.name().toLowerCase(Locale.ROOT);
        String tab = kind == Kind.TEAM ? "teams" : "players";
        String destination = "/tournaments?tab=" + tab + "&" + name + "=" + row.id();

        return new Entry(row.id().toString(), name, List.of(translation), row.icon(), true,
                new Destinations(destination));
    }
}
