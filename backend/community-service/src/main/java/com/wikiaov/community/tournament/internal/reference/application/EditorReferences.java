package com.wikiaov.community.tournament.internal.reference.application;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.wikiaov.community.tournament.internal.application.TournamentErrors;
import com.wikiaov.community.tournament.internal.application.TournamentViews.PageSlice;
import com.wikiaov.community.tournament.internal.domain.ReferenceLabels;
import com.wikiaov.community.tournament.internal.reference.persistence.EditorReferenceRepository;
import com.wikiaov.community.tournament.internal.reference.persistence.EditorReferenceRepository.ReferenceRow;
import java.util.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Service
public class EditorReferences {
    private static final UUID EMPTY_ID = new UUID(0, 0);
    private final EditorReferenceRepository repository;
    private final JsonMapper json;

    public EditorReferences(EditorReferenceRepository repository, JsonMapper json) {
        this.repository = repository;
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
        if (ids != null && (ids.isEmpty() || ids.size() > 50 || ids.stream().anyMatch(Objects::isNull)))
            throw TournamentErrors.invalid("Reference lookup accepts between 1 and 50 UUIDs.");

        String escaped = ReferenceLabels.literalSearch(query);
        var selectedIds = ids == null ? List.of(EMPTY_ID) : ids.stream().distinct().toList();
        var unsorted = PageRequest.of(page.getPageNumber(), page.getPageSize());
        var rows = repository.search(escaped, kind == null ? "" : kind.name(), ids != null, selectedIds, unsorted);

        return PageSlice.from(rows.map(this::entry));
    }

    private Entry entry(ReferenceRow row) {
        var aliases = new LinkedHashSet<String>();
        aliases.add(row.getCode());
        if (row.getShortName() != null && !row.getShortName().isBlank())
            aliases.add(row.getShortName());
        if (row.getAliasesJson() != null && !row.getAliasesJson().equals("null"))
            aliases.addAll(json.readValue(row.getAliasesJson(), new TypeReference<List<String>>() {
            }));
        aliases.remove(row.getName());
        var translation = new Translation("vi-VN", row.getName(), List.copyOf(aliases), "");
        String tab = row.getKind().equals("team") ? "teams" : "players";
        String destination = "/tournaments?tab=" + tab + "&" + row.getKind() + "=" + row.getId();

        return new Entry(row.getId().toString(), row.getKind(), List.of(translation), row.getIcon(), true,
                new Destinations(destination));
    }
}
