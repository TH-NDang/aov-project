package com.wikiaov.community.community.internal.domain;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record PageContent(
        String name,
        String shortName,
        String country,
        String biography,
        String avatarUrl,
        String coverUrl,
        List<Link> links,
        List<Source> sources,
        List<History> history,
        List<Achievement> achievements,
        List<Member> roster,
        List<String> personRoles,
        UUID channelOrganizationId,
        @Nullable UUID organizationId
) {
    public PageContent(String name, String shortName, String country, String biography, String avatarUrl,
            String coverUrl, List<Link> links, List<Source> sources, List<History> history,
            List<Achievement> achievements, List<Member> roster, List<String> personRoles,
            UUID channelOrganizationId) {
        this(name, shortName, country, biography, avatarUrl, coverUrl, links, sources, history, achievements, roster,
                personRoles, channelOrganizationId, null);
    }

    public PageContent {
        links = links == null ? List.of() : List.copyOf(links);
        sources = sources == null ? List.of() : List.copyOf(sources);
        history = history == null ? List.of() : List.copyOf(history);
        achievements = achievements == null ? List.of() : List.copyOf(achievements);
        roster = roster == null ? List.of() : List.copyOf(roster);
        personRoles = personRoles == null ? List.of() : List.copyOf(personRoles);
    }

    public enum Kind {
        ORGANIZATION,
        CIRCUIT,
        TEAM,
        PLAYER,
        PERSON;

        /** The kinds that stand for one person: the only pages with personnel roles or a place in a team roster. */
        public static final Set<Kind> INDIVIDUALS = Set.of(PLAYER, PERSON);
        /** The kinds that stand for a competition identity of the tournament module. */
        public static final Set<Kind> IDENTITIES = Set.of(TEAM, PLAYER);

        public boolean individual() {
            return INDIVIDUALS.contains(this);
        }

        public boolean identity() {
            return IDENTITIES.contains(this);
        }

        /** A circuit is an editorial page: it has no representatives, posts or followers. */
        public boolean community() {
            return this != CIRCUIT;
        }

        /** The kind with this name; null for any other text. */
        public static @Nullable Kind named(@Nullable String name) {
            return Arrays.stream(values()).filter(kind -> kind.name().equals(name)).findFirst().orElse(null);
        }

        /** The names native SQL binds for a set of kinds. */
        public static List<String> names(Collection<Kind> kinds) {
            return kinds.stream().map(Kind::name).sorted().toList();
        }
    }

    public enum Role {
        OWNER,
        EDITOR,
        MODERATOR
    }

    /** The lane a roster member plays, with the same codes as a tournament roster. */
    public enum Lane {
        TOP,
        JUNGLE,
        MID,
        DRAGON,
        SUPPORT
    }

    /** Where a member stands in a team: the starting lineup, the bench, the staff, or gone. */
    public enum Standing {
        ACTIVE,
        SUBSTITUTE,
        LEFT,
        STAFF
    }

    /** {@code official} marks the channel as run by the page's own organization; absent in older content. */
    public record Link(
            String label,
            String url,
            Boolean official
    ) {
    }

    public record Source(
            String label,
            String url,
            LocalDate checkedOn
    ) {
    }

    /** A milestone; {@code tournamentId} names the tournament it happened at, when the app records it. */
    public record History(
            LocalDate startsOn,
            LocalDate endsOn,
            String title,
            UUID relatedPageId,
            String role,
            String sourceUrl,
            @Nullable UUID tournamentId
    ) {
        public History(LocalDate startsOn, LocalDate endsOn, String title, UUID relatedPageId, String role,
                String sourceUrl) {
            this(startsOn, endsOn, title, relatedPageId, role, sourceUrl, null);
        }
    }

    /**
     * A result of a team or player. {@code placement} is the wording shown as written; the rank is stored apart from it:
     * {@code place} is the final place (1 is the title) and {@code placeTo} the last place of a shared standing (5 to 8
     * for "5-8"), while {@code award} marks an individual award, which has no place. Records written before ranks have
     * none of the three, and readers then read the wording.
     */
    public record Achievement(
            String title,
            String placement,
            LocalDate date,
            UUID tournamentId,
            String sourceUrl,
            @Nullable Integer place,
            @Nullable Integer placeTo,
            @Nullable Boolean award
    ) {
    }

    /**
     * A member of a team's roster. {@code lane}, {@code standing} and {@code captain} (absent means no) are what
     * readers group and mark members by; {@code role} and {@code status} stay the wording shown as written, such as a
     * lane with a captain's mark or a standing with its season.
     */
    public record Member(
            UUID pageId,
            String name,
            String role,
            String status,
            LocalDate startsOn,
            LocalDate endsOn,
            String sourceUrl,
            @Nullable Lane lane,
            @Nullable Standing standing,
            @Nullable Boolean captain
    ) {
    }

    public record Presentation(
            String biography,
            String avatarUrl,
            String coverUrl,
            List<Link> links
    ) {
        public Presentation {
            links = links == null ? List.of() : List.copyOf(links);
        }
    }

    public PageContent present(Presentation presentation) {
        if (presentation == null) {
            return this;
        }
        return new PageContent(name, shortName, country, presentation.biography(), presentation.avatarUrl(),
                presentation.coverUrl(), presentation.links(), sources, history, achievements, roster, personRoles,
                channelOrganizationId, organizationId);
    }
}
