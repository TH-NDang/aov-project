package com.wikiaov.community.community.internal.domain;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

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
        UUID channelOrganizationId
) {
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
        PERSON
    }

    public enum Role {
        OWNER,
        EDITOR,
        MODERATOR
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

    public record History(
            LocalDate startsOn,
            LocalDate endsOn,
            String title,
            UUID relatedPageId,
            String role,
            String sourceUrl
    ) {
    }

    public record Achievement(
            String title,
            String placement,
            LocalDate date,
            UUID tournamentId,
            String sourceUrl
    ) {
    }

    public record Member(
            UUID pageId,
            String name,
            String role,
            String status,
            LocalDate startsOn,
            LocalDate endsOn,
            String sourceUrl
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
        if (presentation == null)
            return this;
        return new PageContent(name, shortName, country, presentation.biography(), presentation.avatarUrl(),
                presentation.coverUrl(), presentation.links(), sources, history, achievements, roster, personRoles,
                channelOrganizationId);
    }
}
