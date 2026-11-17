package com.wikiaov.media.internal.query.application;

import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.media.MediaUsage;
import com.wikiaov.media.MediaUsageProvider;
import com.wikiaov.media.internal.application.response.MediaAssetSummary;
import com.wikiaov.media.internal.application.response.MediaUsageState;
import com.wikiaov.media.internal.application.response.MediaUsageSummary;
import com.wikiaov.media.internal.application.response.MediaUsageTotals;
import com.wikiaov.media.internal.query.application.port.CompetitionMediaReferences;
import com.wikiaov.platform.PageSlice;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Usage of every image at once, computed from the owner modules instead of a stored count that could drift. The answer
 * is kept for a moment because a scrolling list asks page after page; one image's own report stays live. Runs outside a
 * transaction because it calls the community service over HTTP; each provider opens its own.
 */
@Service
public class MediaUsageOverview {
    private final ObjectProvider<MediaUsageProvider> providers;
    private final CompetitionMediaReferences competition;
    private final MediaAssetQueries queries;
    private final Clock clock;
    private final Duration reportLifetime;
    private Map<UUID, List<MediaUsage>> report = Map.of();
    private Instant reportExpires = Instant.MIN;

    MediaUsageOverview(ObjectProvider<MediaUsageProvider> providers, CompetitionMediaReferences competition,
            MediaAssetQueries queries, Clock clock,
            @Value("${wiki.media.usage-report-lifetime:1m}") Duration reportLifetime) {
        this.providers = providers;
        this.competition = competition;
        this.queries = queries;
        this.clock = clock;
        this.reportLifetime = reportLifetime;
    }

    public PageSlice<MediaAssetSummary> list(@Nullable MediaSemanticType semanticType, boolean needsCredit,
            @Nullable MediaUsageState filter, int page, int size) {
        var index = index();
        if (filter == null) {
            var rows = queries.list(semanticType, needsCredit, page, size);
            return new PageSlice<>(rows.items().stream().map(row -> row.withUsage(index.summary(row.id()))).toList(),
                    page, size, rows.totalElements());
        }

        var matching = queries.ids(semanticType, needsCredit).stream()
                .filter(id -> index.summary(id).state() == filter).toList();
        var slice = PageSlice.of(matching, page, size);
        var rows = queries.summaries(slice.items());

        return slice.withItems(rows.stream().map(row -> row.withUsage(index.summary(row.id()))).toList());
    }

    public MediaUsageTotals totals(@Nullable MediaSemanticType semanticType, boolean needsCredit) {
        var index = index();
        Map<MediaUsageState, Long> states = new EnumMap<>(MediaUsageState.class);
        for (var state : MediaUsageState.values()) {
            states.put(state, 0L);
        }

        for (var id : queries.ids(semanticType, needsCredit)) {
            states.merge(index.summary(id).state(), 1L, Long::sum);
        }

        return new MediaUsageTotals(states, index.competition() != null);
    }

    private Index index() {
        return new Index(usages(), competition.references().orElse(null));
    }

    /** Waiting requests share one reading instead of each asking every module again. */
    private synchronized Map<UUID, List<MediaUsage>> usages() {
        var now = clock.instant();
        if (now.isBefore(reportExpires)) {
            return report;
        }

        Map<UUID, List<MediaUsage>> usages = new HashMap<>();
        providers.orderedStream().forEach(provider -> provider.findAllUsages().forEach(
                (asset, found) -> usages.computeIfAbsent(asset, ignored -> new ArrayList<>()).addAll(found)));
        report = usages;
        reportExpires = now.plus(reportLifetime);

        return report;
    }

    private record Index(
            Map<UUID, List<MediaUsage>> usages,
            @Nullable Map<UUID, Long> competition
    ) {

        /** A place keeps its strongest use, so a skin art shown now and kept in old revisions counts once, as shown. */
        MediaUsageSummary summary(UUID asset) {
            Map<String, MediaUsageState> places = new HashMap<>();
            for (var usage : usages.getOrDefault(asset, List.of())) {
                places.merge(place(usage), state(usage), (left, right) -> left.compareTo(right) <= 0 ? left : right);
            }

            var counts = places.values().stream()
                    .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
            Long named = competition == null ? null : competition.getOrDefault(asset, 0L);
            var strongest = named != null && named > 0
                    ? MediaUsageState.SHOWN
                    : places.values().stream().min(Comparator.naturalOrder()).orElse(MediaUsageState.NONE);

            return new MediaUsageSummary(strongest, counts.getOrDefault(MediaUsageState.SHOWN, 0L),
                    counts.getOrDefault(MediaUsageState.DRAFT_ONLY, 0L),
                    counts.getOrDefault(MediaUsageState.HISTORY_ONLY, 0L),
                    counts.getOrDefault(MediaUsageState.STORED_ONLY, 0L), named);
        }

        private static MediaUsageState state(MediaUsage usage) {
            if (!usage.shown()) {
                return MediaUsageState.STORED_ONLY;
            }

            return switch (usage.scope()) {
                case CURRENT -> MediaUsageState.SHOWN;
                case DRAFT -> MediaUsageState.DRAFT_ONLY;
                case HISTORICAL -> MediaUsageState.HISTORY_ONLY;
            };
        }

        private static String place(MediaUsage usage) {
            return usage.ownerType() + ":" + usage.ownerId() + ":" + usage.propertyRole();
        }
    }
}
