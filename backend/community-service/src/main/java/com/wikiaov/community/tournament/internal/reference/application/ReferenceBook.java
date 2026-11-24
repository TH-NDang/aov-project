package com.wikiaov.community.tournament.internal.reference.application;

import com.wikiaov.community.tournament.CompetitionPages;
import com.wikiaov.community.tournament.CompetitionPages.NamedPage;
import com.wikiaov.community.tournament.internal.reference.application.ReferenceViews.Event;
import com.wikiaov.community.tournament.internal.reference.application.ReferenceViews.Latest;
import com.wikiaov.community.tournament.internal.reference.application.ReferenceViews.LatestTeam;
import com.wikiaov.community.tournament.internal.reference.application.ReferenceViews.Logo;
import com.wikiaov.community.tournament.internal.reference.application.ReferenceViews.Name;
import com.wikiaov.community.tournament.internal.reference.application.ReferenceViews.Preview;
import com.wikiaov.community.tournament.internal.reference.domain.PublishedCompetition;
import com.wikiaov.community.tournament.internal.reference.domain.PublishedCompetition.Duty;
import com.wikiaov.community.tournament.internal.reference.domain.PublishedCompetition.Player;
import com.wikiaov.community.tournament.internal.reference.domain.PublishedCompetition.Team;
import com.wikiaov.community.tournament.internal.reference.domain.ReferenceKind;
import com.wikiaov.community.tournament.internal.reference.domain.ShownNames;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.jspecify.annotations.Nullable;

/**
 * Everything a text can name, with its preview. Each record stands once: as its published page names it, otherwise as
 * the newest published competition does.
 */
final class ReferenceBook {
    private static final Comparator<PublishedCompetition> NEWEST_FIRST = Comparator
            .comparing((PublishedCompetition one) -> one.tournament().startsOn(),
                    Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(PublishedCompetition::id);

    private final List<PublishedCompetition> competitions;
    private final List<NamedPage> pages;
    private final Map<UUID, UUID> playersByPage;
    private final Map<UUID, String> realNames;
    private final Map<ReferenceKind, List<Name>> names = new EnumMap<>(ReferenceKind.class);
    private final Map<ReferenceKind, Map<UUID, Preview>> previews = new EnumMap<>(ReferenceKind.class);

    private ReferenceBook(List<PublishedCompetition> competitions, List<NamedPage> pages,
            Map<UUID, UUID> playersByPage, Map<UUID, String> realNames) {
        this.competitions = competitions.stream().sorted(NEWEST_FIRST).toList();
        this.pages = pages;
        this.playersByPage = playersByPage;
        this.realNames = realNames;
        for (var kind : ReferenceKind.values()) {
            names.put(kind, new ArrayList<>());
            previews.put(kind, new LinkedHashMap<>());
        }
    }

    /**
     * {@code playersByPage} names the player behind each profile page that crews and staff lists name, if any.
     * {@code realNames} come from the registry of players, since publications carry none. They only keep names drawn
     * from them out.
     */
    static ReferenceBook of(List<PublishedCompetition> competitions, List<NamedPage> pages,
            Map<UUID, UUID> playersByPage, Map<UUID, String> realNames) {
        var book = new ReferenceBook(competitions, pages, playersByPage, realNames);
        book.addEditorialPages();
        book.addCompetitions();
        book.addTeams();
        book.addIndividuals();
        book.dropSharedShortNames();
        return book;
    }

    List<Name> names(Collection<ReferenceKind> kinds) {
        return kinds.stream().flatMap(kind -> names.get(kind).stream()).toList();
    }

    @Nullable
    Preview preview(ReferenceKind kind, UUID id) {
        return previews.get(kind).get(id);
    }

    private void add(Name name, Preview preview) {
        names.get(name.kind()).add(name);
        previews.get(name.kind()).put(name.id(), preview);
    }

    private void addEditorialPages() {
        Map<UUID, Long> seasons = competitions.stream().filter(one -> one.circuit() != null)
                .collect(Collectors.groupingBy(one -> one.circuit().id(), Collectors.counting()));

        addEditorialPages(CompetitionPages.Kind.CIRCUIT, ReferenceKind.CIRCUIT, seasons);
        addEditorialPages(CompetitionPages.Kind.ORGANIZATION, ReferenceKind.ORGANIZATION, Map.of());
    }

    private void addEditorialPages(CompetitionPages.Kind pageKind, ReferenceKind kind, Map<UUID, Long> seasons) {
        for (var page : pages) {
            if (page.kind() != pageKind) {
                continue;
            }
            var name = new Name(page.id(), kind, page.name(), page.shortName(), List.of(),
                    kind.path(page.id(), page.code()), null, List.of());
            add(name, new Preview(name, page.country(), new Logo(page.logoUrl(), null), page.summary(),
                    seasons.getOrDefault(page.id(), 0L).intValue(), null, null));
        }
    }

    private void addCompetitions() {
        var kind = ReferenceKind.COMPETITION;
        for (var one : competitions) {
            var event = one.tournament();
            var circuit = one.circuit();
            var name = new Name(one.id(), kind, event.name(), null, List.of(), kind.path(one.id(), null),
                    circuit == null ? null : circuit.id(), List.of());
            add(name, new Preview(name, event.region(), new Logo(event.logoUrl(), event.logoDarkUrl()), null, 0,
                    new Event(event.tier(), event.startsOn(), event.endsOn(),
                            circuit == null ? null : circuit.name()),
                    null));
        }
    }

    private void addTeams() {
        var seen = new LinkedHashMap<UUID, Seen<Team>>();
        for (var one : competitions) {
            one.teams().forEach((id, team) -> seen.computeIfAbsent(id, any -> new Seen<>(one, team))
                    .in(one, team.name()));
        }

        var kind = ReferenceKind.TEAM;
        var published = identityPages(CompetitionPages.Kind.TEAM);
        var circuits = pages.stream().filter(page -> page.kind() == CompetitionPages.Kind.CIRCUIT).toList();
        seen.values().removeIf(team -> isSeat(team.record, circuits));
        for (var id : union(seen.keySet(), published.keySet())) {
            var page = published.get(id);
            if (!seen.containsKey(id)) {
                add(pageName(kind, id, page, page.shortName()), pagePreview(kind, id, page, page.shortName()));
                continue;
            }
            var team = seen.get(id);
            var record = team.record;
            var label = page == null ? record.name() : page.name();
            var shortName = page == null || page.shortName() == null ? record.shortName() : page.shortName();
            var name = new Name(id, kind, label, shortName,
                    ShownNames.others(concat(team.names, record.aliases()), label, shortName),
                    kind.path(id, code(page)), null, List.of());
            add(name, new Preview(name, record.country(), new Logo(record.logoUrl(), record.logoDarkUrl()),
                    page == null ? null : page.summary(), team.competitions, null, team.latest()));
        }
    }

    /**
     * A team that goes by the name of a circuit is the seat a competition keeps for that circuit's representative. A text
     * that says the name means the circuit.
     */
    private static boolean isSeat(Team team, List<NamedPage> circuits) {
        return circuits.stream().anyMatch(circuit -> team.name().equalsIgnoreCase(circuit.name())
                || team.shortName() != null && team.shortName().equalsIgnoreCase(circuit.shortName()));
    }

    /** Players, then the personnel who are none of them: someone who both plays and casts is one person here. */
    private void addIndividuals() {
        var players = new LinkedHashMap<UUID, Seen<Player>>();
        var people = new LinkedHashMap<UUID, Seen<String>>();
        for (var one : competitions) {
            one.players().forEach((id, player) -> players.computeIfAbsent(id, any -> new Seen<>(one, player))
                    .in(one, player.nickname()));
            one.people().forEach((id, person) -> people.computeIfAbsent(id, any -> new Seen<>(one, person.name()))
                    .in(one, person.name()));
            for (var seat : one.rosters()) {
                var player = players.get(seat.playerId());
                if (player != null) {
                    player.with(seat.teamId(), one);
                }
            }
            for (var duty : duties(one)) {
                var person = people.get(duty.pageId());
                if (person != null) {
                    person.did(duty, one);
                }
            }
        }

        var published = identityPages(CompetitionPages.Kind.PLAYER);
        joinPersonnelToPlayers(people, players, published.keySet());
        addPlayers(players, published);
        addPeople(people);
    }

    private void joinPersonnelToPlayers(Map<UUID, Seen<String>> people, Map<UUID, Seen<Player>> players,
            Set<UUID> published) {
        for (var pageId : List.copyOf(people.keySet())) {
            var playerId = playersByPage.get(pageId);
            if (playerId == null || !players.containsKey(playerId) && !published.contains(playerId)) {
                continue;
            }
            var personnel = people.remove(pageId);
            if (players.containsKey(playerId)) {
                players.get(playerId).teams.addAll(personnel.teams);
            }
        }
    }

    private void addPlayers(Map<UUID, Seen<Player>> players, Map<UUID, NamedPage> published) {
        var kind = ReferenceKind.PLAYER;
        for (var id : union(players.keySet(), published.keySet())) {
            var page = published.get(id);
            if (!players.containsKey(id)) {
                add(pageName(kind, id, page, null), pagePreview(kind, id, page, null));
                continue;
            }
            var player = players.get(id);
            var record = player.record;
            var label = page == null ? record.nickname() : page.name();
            var name = new Name(id, kind, label, null,
                    ShownNames.othersOfPlayer(concat(player.names, record.aliases()), label, realNames.get(id)),
                    kind.path(id, code(page)), null, List.copyOf(player.teams));
            add(name, new Preview(name, record.country(), Logo.NONE, null, player.competitions, null,
                    player.latest()));
        }
    }

    private void addPeople(Map<UUID, Seen<String>> people) {
        var kind = ReferenceKind.PERSON;
        Map<UUID, NamedPage> published = pages.stream().filter(page -> page.kind() == CompetitionPages.Kind.PERSON)
                .collect(Collectors.toMap(NamedPage::id, Function.identity()));
        for (var id : union(people.keySet(), published.keySet())) {
            var page = published.get(id);
            if (!people.containsKey(id)) {
                add(pageName(kind, id, page, null), pagePreview(kind, id, page, null));
                continue;
            }
            var person = people.get(id);
            var label = page == null ? person.record : page.name();
            var name = new Name(id, kind, label, null, ShownNames.others(person.names, label),
                    kind.path(id, code(page)), null, List.copyOf(person.teams));
            add(name, new Preview(name, page == null ? null : page.country(), Logo.NONE, null, person.competitions,
                    null, person.latest()));
        }
    }

    /** A short name that is also somebody's nickname does not say whom a text means, so no text is read by it. */
    private void dropSharedShortNames() {
        Set<String> nicknames = names(ReferenceKind.INDIVIDUALS).stream()
                .flatMap(name -> Stream.concat(Stream.of(name.name()), name.aliases().stream()))
                .collect(Collectors.toSet());
        for (var kind : ReferenceKind.CORE) {
            names.get(kind).replaceAll(name -> name.shortName() != null && nicknames.contains(name.shortName())
                    ? name.withoutShortName()
                    : name);
        }
    }

    /** A published page that no published competition names. */
    private static Name pageName(ReferenceKind kind, UUID id, NamedPage page, @Nullable String shortName) {
        return new Name(id, kind, page.name(), shortName, List.of(), kind.path(id, page.code()), null, List.of());
    }

    private static Preview pagePreview(ReferenceKind kind, UUID id, NamedPage page, @Nullable String shortName) {
        return new Preview(pageName(kind, id, page, shortName), page.country(), new Logo(page.logoUrl(), null),
                page.summary(), 0, null, null);
    }

    private Map<UUID, NamedPage> identityPages(CompetitionPages.Kind kind) {
        return pages.stream().filter(page -> page.kind() == kind && page.entityId() != null)
                .collect(Collectors.toMap(NamedPage::entityId, Function.identity()));
    }

    private static Set<UUID> union(Collection<UUID> first, Collection<UUID> second) {
        var all = new LinkedHashSet<>(first);
        all.addAll(second);
        return all;
    }

    private static List<String> concat(Collection<String> first, Collection<String> second) {
        return Stream.concat(first.stream(), second.stream()).toList();
    }

    private static @Nullable String code(@Nullable NamedPage page) {
        return page == null ? null : page.code();
    }

    private static List<Duty> duties(PublishedCompetition one) {
        return Stream.of(one.tournament().staff(), one.tournament().broadcast(), one.crews()).flatMap(List::stream)
                .filter(duty -> duty.pageId() != null).toList();
    }

    /** A record through the competitions that name it, met from the newest to the oldest. */
    private static final class Seen<T> {
        private final PublishedCompetition newest;
        private final T record;
        private final Set<String> names = new LinkedHashSet<>();
        private final Set<UUID> teams = new LinkedHashSet<>();
        private final Set<String> roles = new LinkedHashSet<>();
        private @Nullable UUID newestTeam;
        private int competitions;

        private Seen(PublishedCompetition newest, T record) {
            this.newest = newest;
            this.record = record;
        }

        private void in(PublishedCompetition one, String name) {
            names.add(name);
            competitions++;
        }

        private void with(UUID teamId, PublishedCompetition one) {
            teams.add(teamId);
            if (one == newest && newestTeam == null) {
                newestTeam = teamId;
            }
        }

        private void did(Duty duty, PublishedCompetition one) {
            if (duty.teamId() != null) {
                with(duty.teamId(), one);
            }
            if (one == newest && duty.role() != null) {
                roles.add(duty.role());
            }
        }

        private Latest latest() {
            var team = newestTeam == null ? null : newest.teams().get(newestTeam);

            return new Latest(newest.id(), newest.tournament().name(), team == null
                    ? null
                    : new LatestTeam(newestTeam, team.name(), team.shortName(), team.logoUrl(), team.logoDarkUrl()),
                    List.copyOf(roles));
        }
    }
}
