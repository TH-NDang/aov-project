package com.wikiaov.terminology;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.*;

/** Compact authoring projections; each module selects and reads its own records. */
public interface AdminReferenceProvider {
    List<Candidate> references(UUID rulesetId, Map<UUID, Long> patchOrdinals);

    record Translation(
            String locale,
            String name,
            List<String> aliases,
            String description
    ) {
    }

    record Destinations(
            String admin
    ) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record Candidate(
            UUID id,
            String kind,
            List<Translation> translations,
            UUID iconAssetId,
            boolean autoMatch,
            Destinations destinations
    ) {
    }

    /** A scalar query row deliberately excludes gameplay, skills, source records and media metadata. */
    record Row(
            UUID id,
            UUID revisionId,
            UUID iconAssetId,
            String locale,
            String name,
            String description
    ) {
    }

    static List<Candidate> candidates(List<Row> rows, String kind, UUID rulesetId) {
        var grouped = new LinkedHashMap<UUID, List<Row>>();
        for (var row : rows)
            if (row.name() != null && !row.name().isBlank())
                grouped.computeIfAbsent(row.id(), ignored -> new ArrayList<>()).add(row);
        return grouped.values().stream().map(values -> {
            var first = values.getFirst();
            String route = switch (kind) {
                case "hero" -> "hero";
                case "item" -> "items";
                case "enchantment" -> "enchantments";
                case "spell" -> "spells";
                case "arcana" -> "arcana";
                default -> throw new IllegalArgumentException("Unsupported reference kind.");
            };
            String destination = kind.equals("hero")
                    ? "/hero/" + first.id() + "?revision=" + first.revisionId() + "&ruleset=" + rulesetId
                    : "/" + route + "?item=" + first.id() + "&ruleset=" + rulesetId;
            return new Candidate(first.id(), kind, values.stream()
                    .map(row -> new Translation(row.locale(), row.name(), List.of(),
                            row.description() == null ? "" : row.description()))
                    .toList(), first.iconAssetId(), kind.equals("hero"), new Destinations(destination));
        }).toList();
    }
}
