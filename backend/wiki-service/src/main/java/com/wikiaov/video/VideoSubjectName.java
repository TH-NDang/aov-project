package com.wikiaov.video;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * One translated name of a subject in one revision, as read by the owning module. Revisions and locales repeat a
 * subject, so {@link #collapse} turns these rows into one {@link VideoSubject} per subject.
 */
public record VideoSubjectName(
        UUID id,
        @Nullable String key,
        String code,
        @Nullable String locale,
        @Nullable String name,
        long revision
) {

    public VideoSubjectName(UUID id, String code, @Nullable String locale, @Nullable String name, long revision) {
        this(id, null, code, locale, name, revision);
    }

    /**
     * Picks the newest name in {@code locale}, or the newest in any locale, and keeps the others as aliases so imported
     * data can still match a name that has since been renamed.
     */
    public static List<VideoSubject> collapse(VideoSubjectKind kind, List<VideoSubjectName> rows, String locale,
            Map<UUID, List<String>> extraAliases) {
        Map<String, List<VideoSubjectName>> groups = new LinkedHashMap<>();
        for (VideoSubjectName row : rows) {
            groups.computeIfAbsent(row.id() + "|" + row.key(), ignored -> new ArrayList<>()).add(row);
        }

        List<VideoSubject> subjects = new ArrayList<>();
        for (List<VideoSubjectName> group : groups.values()) {
            VideoSubjectName first = group.getFirst();
            String fallback = first.key() != null ? first.key() : first.code();
            List<VideoSubjectName> named = group.stream().filter(row -> row.name() != null && !row.name().isBlank())
                    .sorted(Comparator.comparingLong(VideoSubjectName::revision).reversed()).toList();
            String name = named.stream().filter(row -> locale.equals(row.locale())).findFirst()
                    .or(() -> named.stream().findFirst()).map(VideoSubjectName::name).orElse(fallback);

            var aliases = new LinkedHashSet<String>();
            named.stream().map(VideoSubjectName::name).filter(other -> !other.equals(name)).forEach(aliases::add);
            aliases.addAll(extraAliases.getOrDefault(first.id(), List.of()));
            subjects.add(new VideoSubject(kind, first.id(), first.key(), first.code(), name, List.copyOf(aliases)));
        }
        subjects.sort(Comparator.comparing(VideoSubject::code)
                .thenComparing(subject -> Objects.toString(subject.key(), "")));

        return subjects;
    }
}
