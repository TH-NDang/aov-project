package com.wikiaov.community.tournament.internal.statistics.application;

import com.wikiaov.community.tournament.internal.application.TournamentErrors;
import com.wikiaov.community.tournament.internal.planning.persistence.CompetitionPlanRepository;
import com.wikiaov.community.tournament.internal.statistics.application.LineupViews.HeroBuilds;
import com.wikiaov.community.tournament.internal.statistics.application.LineupViews.Lineups;
import com.wikiaov.community.tournament.internal.statistics.application.StatisticsViews.GameStatistics;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup;
import com.wikiaov.community.tournament.internal.statistics.persistence.PublishedLineups;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.DigestUtils;

/**
 * What the published games of a published competition tell: its statistics, its lineups and its builds. Only the
 * snapshot of a game says which competition it was played in, so finding the games of one competition opens every
 * snapshot. The last reading of each competition is therefore kept until a game is published or withdrawn anywhere,
 * which one query that opens none of them tells on each request. A new reading that finds the same games has the same
 * revision, so browsers keep theirs.
 */
@Service
public class CompetitionStatistics {
    /** How many competitions keep their last reading; the one asked for longest ago makes room. */
    static final int MAX_READINGS = 64;

    private final CompetitionPlanRepository plans;
    private final PublishedLineups games;
    private final TransactionTemplate reads;
    private final Map<UUID, Reading> readings = Collections.synchronizedMap(new RecentReadings());
    private final Object reading = new Object();

    public CompetitionStatistics(CompetitionPlanRepository plans, PublishedLineups games,
            PlatformTransactionManager transactions) {
        this.plans = plans;
        this.games = games;
        this.reads = new TransactionTemplate(transactions);
        this.reads.setReadOnly(true);
    }

    /** The same revision means the same games, published at the same moments, and so the same answers. */
    public record Counted(
            String revision,
            GameStatistics statistics,
            Lineups lineups,
            Map<UUID, HeroBuilds> builds
    ) {
        /** What a hero was played with; a hero nobody played has no builds. */
        public HeroBuilds builds(UUID heroId) {
            return builds.getOrDefault(heroId, HeroBuilds.NONE);
        }
    }

    public Counted of(UUID competitionId) {
        long asked = System.nanoTime();
        var publications = reads.execute(status -> publications(competitionId));
        var kept = readings.get(competitionId);
        if (kept != null && kept.publications.equals(publications)) {
            return kept.counted;
        }

        // Requests that arrive during a reading wait, without a connection of their own. One that began after a request
        // arrived holds everything published before it, so those who waited together read the games once more, not
        // once each, also while games are being published one after another.
        synchronized (reading) {
            kept = readings.get(competitionId);
            if (kept == null || !kept.publications.equals(publications) && kept.begun - asked < 0) {
                kept = read(competitionId);
                readings.put(competitionId, kept);
            }
            return kept.counted;
        }
    }

    private Reading read(UUID competitionId) {
        long begun = System.nanoTime();
        // Taken before the games are read: a game published in between is read once more, never missed.
        var publications = reads.execute(status -> publications(competitionId));

        return new Reading(begun, publications, reads.execute(status -> count(competitionId)));
    }

    private String publications(UUID competitionId) {
        if (!plans.existsByIdAndPublishedAtIsNotNull(competitionId)) {
            throw TournamentErrors.missing();
        }

        return games.publications();
    }

    private Counted count(UUID competitionId) {
        var lineups = games.of(competitionId);
        var heroes = HeroRoll.of(lineups);

        return new Counted(revision(lineups), StatisticsTally.of(lineups, heroes), LineupList.of(lineups, heroes),
                BuildList.of(lineups, heroes));
    }

    private static String revision(List<PublishedLineup> lineups) {
        var published = lineups.stream().map(game -> game.id() + "@" + game.publishedAt())
                .collect(Collectors.joining(","));

        return DigestUtils.md5DigestAsHex(published.getBytes(StandardCharsets.UTF_8));
    }

    private record Reading(
            long begun,
            String publications,
            Counted counted
    ) {
    }

    private static final class RecentReadings extends LinkedHashMap<UUID, Reading> {
        private RecentReadings() {
            super(16, 0.75f, true);
        }

        @Override
        protected boolean removeEldestEntry(Map.Entry<UUID, Reading> eldest) {
            return size() > MAX_READINGS;
        }
    }
}
