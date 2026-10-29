package com.wikiaov.community.tournament.internal.application;

import com.wikiaov.community.platform.ApiException;
import com.wikiaov.community.tournament.internal.application.TournamentViews.*;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.*;
import com.wikiaov.community.tournament.internal.archive.application.RegistryArchivePolicy;
import com.wikiaov.community.tournament.internal.archive.domain.RecordState;
import com.wikiaov.community.tournament.internal.archive.domain.RegistryKind;
import com.wikiaov.community.tournament.internal.domain.GameRules;
import com.wikiaov.community.tournament.internal.domain.SeriesPickRule;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import com.wikiaov.community.tournament.internal.persistence.*;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class GameRecords {
    private final RegistryArchivePolicy archives;
    private final GameRepository games;
    private final TeamRepository teams;
    private final PlayerRepository players;
    private final SeriesRepository series;
    private final TournamentRepository tournaments;
    private final PublicationRepository publications;

    public GameRecords(GameRepository games, TeamRepository teams, PlayerRepository players, SeriesRepository series,
            TournamentRepository tournaments, PublicationRepository publications, RegistryArchivePolicy archives) {
        this.archives = archives;
        this.games = games;
        this.teams = teams;
        this.players = players;
        this.series = series;
        this.tournaments = tournaments;
        this.publications = publications;
    }

    @Transactional(readOnly = true)
    public PageSlice<View<Game>> list(UUID seriesId, RecordState state, Pageable page) {
        return PageSlice
                .from(games.search(seriesId, state.name(), page).map(this::view));
    }

    @Transactional(readOnly = true)
    public View<Game> get(UUID id) {
        return view(games.findById(id).orElseThrow(TournamentErrors::missing));
    }

    public View<Game> create(Game content, String actor) {
        archives.lockWrites();
        validateDraft(null, content);
        var row = games.saveAndFlush(new GameRecord(UUID.randomUUID(), content, actor));
        return view(row);
    }

    public View<Game> update(UUID id, Long version, Game content, String actor) {
        archives.lockWrites();
        validateDraft(id, content);
        var row = games.findById(id).orElseThrow(TournamentErrors::missing);
        RegistryArchivePolicy.requireActive(row);
        TournamentErrors.version(row.getVersion(), version);

        row.setContent(content, actor);
        games.flush();
        return view(row);
    }

    public View<Game> publish(UUID id, Long version, Catalog catalog, String actor) {
        archives.lockWrites();
        var row = games.findById(id).orElseThrow(TournamentErrors::missing);
        RegistryArchivePolicy.requireActive(row);
        TournamentErrors.version(row.getVersion(), version);
        var content = row.getContent();
        archives.validateParents(content);
        var missing = new ArrayList<>(GameRules.violations(content, true, catalog));
        var match = content.seriesId() == null ? null : series.findById(content.seriesId()).orElse(null);
        if (match == null)
            missing.add("seriesId.notFound");
        if (match != null && content.number() != null && content.number() > match.getContent().bestOf())
            missing.add("number.exceedsBestOf");
        var teamCopies = new LinkedHashMap<UUID, Team>();
        var playerCopies = new LinkedHashMap<UUID, Player>();
        for (var side : content.sides()) {
            if (side.teamId() != null)
                teams.findById(side.teamId()).ifPresentOrElse(team -> teamCopies.put(team.getId(), team.getContent()),
                        () -> missing.add("sides.teamId.notFound"));
            for (var participant : side.participants())
                if (participant.playerId() != null)
                    players.findById(participant.playerId()).ifPresentOrElse(
                            player -> playerCopies.put(player.getId(), player.getContent()),
                            () -> missing.add("sides.participants.playerId.notFound"));
        }
        if (match != null && !new HashSet<>(teamCopies.keySet())
                .equals(Set.of(match.getContent().teamAId(), match.getContent().teamBId())))
            missing.add("sides.teams.matchSeries");
        if (!missing.isEmpty())
            throw new PublicationIncomplete(missing);
        var tournament = tournaments.findById(match.getContent().tournamentId()).orElseThrow(TournamentErrors::missing);

        var resolved = catalog.resolvedContext();
        var frozen = new Game(content.seriesId(), content.number(), content.region(), content.locale(),
                resolved.seasonId(), resolved.patchVariantId(), content.startedAt(), content.durationSeconds(),
                content.winner(), content.sourceUrl(), content.sourceTimestampSeconds(), content.note(),
                content.sides(), content.includeUnscoped(), content.timeline(), content.draft());
        var snapshot = new PublishedGame(id, Instant.now(), frozen, Map.copyOf(teamCopies), Map.copyOf(playerCopies),
                usedCatalog(content, catalog), match.getContent(), tournament.getContent(), resolved);
        row.publish(snapshot, actor);
        publications.save(new PublicationRecord(UUID.randomUUID(), id, snapshot, actor));
        games.flush();
        return view(row);
    }

    public View<Game> withdraw(UUID id, Long version, String actor) {
        archives.lockWrites();
        var row = games.findById(id).orElseThrow(TournamentErrors::missing);
        RegistryArchivePolicy.requireActive(row);
        TournamentErrors.version(row.getVersion(), version);
        if (row.getPublishedSnapshot() != null)
            publications.save(
                    new PublicationRecord(UUID.randomUUID(), id, row.getPublishedSnapshot(), actor, "WITHDRAWAL"));
        row.withdraw(actor);
        games.flush();
        return view(row);
    }

    private void validateDraft(UUID id, Game content) {
        var violations = GameRules.violations(content, false, null);
        if (!violations.isEmpty())
            throw new ApiException(TournamentErrorCode.TOURNAMENT_INVALID_CONTENT, "Invalid game observations.",
                    Map.of("missingFields", violations));
        var match = content.seriesId() == null ? null : series.findById(content.seriesId()).orElse(null);
        if (content.seriesId() != null && match == null)
            throw TournamentErrors.invalid("Choose an existing series.");
        if (content.region() != null && !content.region().matches("[A-Z]{2,16}"))
            throw TournamentErrors.invalid("Invalid market code.");
        archives.validateParents(content);
        if (match != null) {
            var others = games.search(content.seriesId(), RecordState.ACTIVE.name(), Pageable.unpaged()).stream()
                    .filter(row -> !row.getId().equals(id)).map(GameRecord::getContent).toList();
            var reused = SeriesPickRule.violations(content, match.getContent().bestOf(), others);
            if (!reused.isEmpty())
                throw new ApiException(TournamentErrorCode.TOURNAMENT_INVALID_CONTENT,
                        "A team picked a hero it already played earlier in this series.",
                        Map.of("missingFields", reused));
        }
    }

    private View<Game> view(GameRecord row) {
        return new View<>(row.getId(), row.getVersion(), row.getCreatedAt(), row.getUpdatedAt(), row.getContent(),
                GameRules.violations(row.getContent(), true, null), row.getPublishedAt(), row.getDeletedAt());
    }

    private static Catalog usedCatalog(Game content, Catalog catalog) {
        var heroIds = new HashSet<UUID>();
        var spellIds = new HashSet<UUID>();
        var arcanaIds = new HashSet<UUID>();
        var enchantmentIds = new HashSet<UUID>();
        var itemIds = new HashSet<UUID>();
        for (var side : content.sides()) {
            side.bans().forEach(value -> add(heroIds, value));
            for (var participant : side.participants()) {
                add(heroIds, participant.hero());
                add(spellIds, participant.spell());
                participant.arcana().entries().forEach(value -> add(arcanaIds, value.selection()));
                participant.enchantments().entries().forEach(value -> add(enchantmentIds, value.selection()));
                participant.equipmentSnapshots()
                        .forEach(value -> value.slots().forEach(slot -> add(itemIds, slot.item())));
                participant.equipmentEvents().forEach(value -> {
                    add(itemIds, value.item());
                    add(itemIds, value.replacedItem());
                });
            }
        }
        return new Catalog(used(catalog.heroes(), heroIds), used(catalog.items(), itemIds),
                used(catalog.arcana(), arcanaIds), used(catalog.enchantments(), enchantmentIds),
                used(catalog.spells(), spellIds), catalog.resolvedContext());
    }

    private static void add(Set<UUID> ids, Selection selection) {
        if (selection != null && selection.id() != null)
            ids.add(selection.id());
    }

    private static List<Reference> used(List<Reference> references, Set<UUID> ids) {
        return references.stream().filter(reference -> ids.contains(reference.id())).toList();
    }

    @Transactional(readOnly = true)
    public Impact deletionImpact(UUID id) {
        var row = games.findById(id).orElseThrow(TournamentErrors::missing);
        return archives.impact(RegistryKind.GAME, row);
    }

    public State lifecycle(UUID id, Long version, Action action, String actor) {
        archives.lockWrites();
        var row = games.findById(id).orElseThrow(TournamentErrors::missing);
        archives.mutate(RegistryKind.GAME, row, row.getContent(), version, action, actor);
        games.flush();
        return RegistryArchivePolicy.state(row);
    }
}
