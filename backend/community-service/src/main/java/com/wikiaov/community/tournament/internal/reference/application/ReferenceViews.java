package com.wikiaov.community.tournament.internal.reference.application;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.TournamentTier;
import com.wikiaov.community.tournament.internal.reference.domain.ReferenceKind;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** The public answers about what a text can name. */
public final class ReferenceViews {
    private ReferenceViews() {
    }

    /**
     * The names of one record and the address that opens it. A competition carries the circuit it is a season of, a
     * player or person the teams they were with, the latest first. Nothing here is a picture or a real name, and a
     * short name stands here only while nobody has it as a nickname.
     */
    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    public record Name(
            UUID id,
            ReferenceKind kind,
            String name,
            @Nullable String shortName,
            List<String> aliases,
            String path,
            @Nullable UUID circuitId,
            List<UUID> teamIds
    ) {
        Name withoutShortName() {
            return new Name(id, kind, name, null, aliases, path, circuitId, teamIds);
        }
    }

    /** Every name of some kinds at once, so a browser keeps one answer instead of a page per search. */
    public record Names(
            List<Name> items
    ) {
    }

    /**
     * What a reader sees of a record before opening it. {@code summary} is the first paragraph of a page's
     * introduction, {@code competitions} how many published competitions there are of a circuit or with someone.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Preview(
            UUID id,
            ReferenceKind kind,
            String name,
            @Nullable String shortName,
            String path,
            @Nullable String country,
            @Nullable String logoUrl,
            @Nullable String logoDarkUrl,
            @Nullable String summary,
            int competitions,
            @Nullable Event event,
            @Nullable Latest latest
    ) {
        Preview(Name name, @Nullable String country, Logo logo, @Nullable String summary, int competitions,
                @Nullable Event event, @Nullable Latest latest) {
            this(name.id(), name.kind(), name.name(), name.shortName(), name.path(), country, logo.url(),
                    logo.darkUrl(), summary, competitions, event, latest);
        }
    }

    record Logo(
            @Nullable String url,
            @Nullable String darkUrl
    ) {
        /** Of a person, and of anyone whose logo is not known. */
        static final Logo NONE = new Logo(null, null);
    }

    /** When a competition takes place, how it ranks and the circuit it is a season of. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Event(
            @Nullable TournamentTier tier,
            @Nullable LocalDate startsOn,
            @Nullable LocalDate endsOn,
            @Nullable String circuit
    ) {
    }

    /** The newest published competition with someone: their team there, and what they did when they did not play. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Latest(
            UUID competitionId,
            String competition,
            @Nullable LatestTeam team,
            List<String> roles
    ) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record LatestTeam(
            UUID id,
            String name,
            @Nullable String shortName,
            @Nullable String logoUrl,
            @Nullable String logoDarkUrl
    ) {
    }
}
