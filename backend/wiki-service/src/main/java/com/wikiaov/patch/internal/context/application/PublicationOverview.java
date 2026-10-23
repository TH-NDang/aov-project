package com.wikiaov.patch.internal.context.application;

import com.wikiaov.patch.internal.application.response.PublicationOverviewView.*;

import com.wikiaov.patch.internal.application.response.PublicationOverviewView.Market;
import com.wikiaov.patch.internal.application.response.PublicationOverviewView.Snapshot;
import java.time.Clock;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PublicationOverview {
    private final MarketPublicationOverview markets;
    private final SeasonPublicationOverview seasons;
    private final PatchPublicationOverview patches;
    private final Clock clock;

    public PublicationOverview(MarketPublicationOverview markets, SeasonPublicationOverview seasons,
            PatchPublicationOverview patches, Clock clock) {
        this.markets = markets;
        this.seasons = seasons;
        this.patches = patches;
        this.clock = clock;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    public Snapshot read() {
        var now = clock.instant();
        var reviews = patches.readReviews();
        var rules = markets.readRules();
        var calendar = seasons.readCalendar();
        var timeline = patches.readTimeline(reviews);
        var currentMarkets = markets.current(rules, calendar, timeline, now);
        var currentReleaseIds = currentMarkets.stream().map(Market::currentReleaseId).filter(Objects::nonNull)
                .collect(Collectors.toSet());

        return new Snapshot(now, currentMarkets, markets.rulesets(rules), markets.assignments(rules),
                seasons.seasons(calendar), seasons.schedules(calendar, now), patches.variants(timeline),
                patches.releases(timeline, currentReleaseIds, now));
    }
}
