package com.wikiaov.community.tournament.internal.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

public final class TournamentContent {
    private TournamentContent() {
    }

    public record Selection(
            UUID id,
            String name
    ) {
        public boolean present() {
            return id != null || name != null && !name.isBlank();
        }
    }

    /** {@code PARTIAL}: the source showed part of a loadout, so entries may be incomplete or lack an exact name. */
    public enum ObservationStatus {
        UNKNOWN,
        NOT_SHOWN,
        PARTIAL,
        KNOWN
    }

    public enum Lane {
        TOP,
        JUNGLE,
        MID,
        DRAGON,
        SUPPORT
    }

    public enum Side {
        BLUE,
        RED
    }

    public enum EventType {
        BUY,
        SELL,
        UPGRADE,
        SWAP
    }

    public record Team(
            String code,
            String name,
            String shortName,
            String country,
            String logoUrl,
            List<String> aliases
    ) {
        public Team {
            aliases = aliases == null
                    ? List.of()
                    : aliases.stream().map(value -> value == null ? null : value.strip()).toList();
        }

        public Team(String code, String name, String shortName, String country, String logoUrl) {
            this(code, name, shortName, country, logoUrl, List.of());
        }
    }

    public record Player(
            String code,
            String nickname,
            String fullName,
            String country,
            String photoUrl,
            List<String> aliases
    ) {
        public Player {
            aliases = aliases == null
                    ? List.of()
                    : aliases.stream().map(value -> value == null ? null : value.strip()).toList();
        }

        public Player(String code, String nickname, String fullName, String country) {
            this(code, nickname, fullName, country, null, List.of());
        }
    }

    public enum RosterStatus {
        ACTIVE,
        SUBSTITUTE,
        INACTIVE,
        UNKNOWN
    }

    public record RosterMembership(
            UUID tournamentId,
            UUID teamId,
            UUID playerId,
            Lane lane,
            String jerseyNumber,
            RosterStatus status,
            LocalDate startsOn,
            LocalDate endsOn,
            String sourceUrl,
            Verification verification,
            String note
    ) {
        public RosterMembership {
            jerseyNumber = jerseyNumber == null ? null : jerseyNumber.strip();
            status = status == null ? RosterStatus.UNKNOWN : status;
            verification = verification == null ? Verification.UNVERIFIED : verification;
        }
    }

    public record Tournament(
            String code,
            String name,
            String region,
            Integer year,
            LocalDate startsOn,
            LocalDate endsOn,
            String sourceUrl,
            String note,
            String logoUrl,
            TournamentTier tier,
            CompetitionType competitionType,
            VenueMode venueMode,
            TournamentStatus status,
            TournamentResult result
    ) {
        public Tournament {
            tier = tier == null ? TournamentTier.UNKNOWN : tier;
            competitionType = competitionType == null ? CompetitionType.UNKNOWN : competitionType;
            venueMode = venueMode == null ? VenueMode.UNKNOWN : venueMode;
            status = status == null ? TournamentStatus.UNKNOWN : status;
        }

        public Tournament(String code, String name, String region, Integer year, LocalDate startsOn,
                LocalDate endsOn, String sourceUrl, String note) {
            this(code, name, region, year, startsOn, endsOn, sourceUrl, note, null, null, null, null, null, null);
        }
    }

    public enum TournamentTier {
        S,
        A,
        B,
        C,
        UNKNOWN
    }

    public enum CompetitionType {
        LEAGUE,
        CUP,
        QUALIFIER,
        UNKNOWN
    }

    public enum VenueMode {
        ONLINE,
        OFFLINE,
        HYBRID,
        UNKNOWN
    }

    public enum TournamentStatus {
        UPCOMING,
        ONGOING,
        FINISHED,
        ANNOUNCED,
        UNKNOWN
    }

    public enum Verification {
        PRIMARY,
        SECONDARY_CORROBORATED,
        SECONDARY_CAPTURE,
        SECONDARY_PRESS_ONLY,
        UNVERIFIED
    }

    public record TournamentResult(
            String winnerName,
            String runnerUpName,
            Integer winnerScore,
            Integer runnerUpScore,
            String sourceUrl,
            Verification verification,
            LocalDate verifiedOn
    ) {
        public TournamentResult {
            winnerName = winnerName == null ? null : winnerName.strip();
            runnerUpName = runnerUpName == null ? null : runnerUpName.strip();
            verification = verification == null ? Verification.UNVERIFIED : verification;
        }
    }

    public record Series(
            String code,
            UUID tournamentId,
            String name,
            String stage,
            UUID teamAId,
            UUID teamBId,
            Integer bestOf,
            Instant scheduledAt,
            String sourceUrl,
            String note,
            SeriesResult result
    ) {
        public Series(String code, UUID tournamentId, String name, String stage, UUID teamAId, UUID teamBId,
                Integer bestOf, Instant scheduledAt, String sourceUrl, String note) {
            this(code, tournamentId, name, stage, teamAId, teamBId, bestOf, scheduledAt, sourceUrl, note, null);
        }
    }

    public record SeriesResult(
            Integer scoreA,
            Integer scoreB,
            String sourceUrl,
            Verification verification,
            LocalDate verifiedOn
    ) {
        public SeriesResult {
            verification = verification == null ? Verification.UNVERIFIED : verification;
        }
    }

    public record ArcanaAllocation(
            Selection selection,
            Integer count,
            String color
    ) {
    }

    public record EnchantmentAllocation(
            Selection selection,
            boolean primary,
            Integer tier,
            String branchCode
    ) {
    }

    /** An observed loadout; {@code observedAtSeconds} is the game second the source showed it. */
    public record Loadout<T>(
            ObservationStatus status,
            List<T> entries,
            String note,
            Integer observedAtSeconds
    ) {
        public Loadout {
            entries = entries == null ? List.of() : List.copyOf(entries);
            status = status == null ? ObservationStatus.UNKNOWN : status;
        }

        public Loadout(ObservationStatus status, List<T> entries, String note) {
            this(status, entries, note, null);
        }
    }

    public record InventorySlot(
            Integer slot,
            boolean known,
            Selection item
    ) {
    }

    public record EquipmentSnapshot(
            Integer atSeconds,
            List<InventorySlot> slots,
            String note
    ) {
        public EquipmentSnapshot {
            slots = slots == null ? List.of() : List.copyOf(slots);
        }
    }

    public record EquipmentEvent(
            Integer atSeconds,
            EventType type,
            Selection item,
            Selection replacedItem,
            Integer fromSlot,
            Integer toSlot,
            String note
    ) {
    }

    public record Participant(
            UUID playerId,
            Lane lane,
            Selection hero,
            Selection spell,
            Loadout<ArcanaAllocation> arcana,
            Loadout<EnchantmentAllocation> enchantments,
            List<EquipmentSnapshot> equipmentSnapshots,
            List<EquipmentEvent> equipmentEvents,
            String note,
            Integer spellObservedAtSeconds
    ) {
        public Participant {
            arcana = arcana == null ? new Loadout<>(null, null, null) : arcana;
            enchantments = enchantments == null ? new Loadout<>(null, null, null) : enchantments;
            equipmentSnapshots = equipmentSnapshots == null ? List.of() : List.copyOf(equipmentSnapshots);
            equipmentEvents = equipmentEvents == null ? List.of() : List.copyOf(equipmentEvents);
        }

        public Participant(UUID playerId, Lane lane, Selection hero, Selection spell,
                Loadout<ArcanaAllocation> arcana, Loadout<EnchantmentAllocation> enchantments,
                List<EquipmentSnapshot> equipmentSnapshots, List<EquipmentEvent> equipmentEvents, String note) {
            this(playerId, lane, hero, spell, arcana, enchantments, equipmentSnapshots, equipmentEvents, note, null);
        }
    }

    public record GameSide(
            Side side,
            UUID teamId,
            List<Selection> bans,
            List<Participant> participants
    ) {
        public GameSide {
            bans = bans == null ? List.of() : List.copyOf(bans);
            participants = participants == null ? List.of() : List.copyOf(participants);
        }
    }

    public enum TimelineKind {
        KILL,
        OBJECTIVE,
        NOTE
    }

    public enum ObjectiveKind {
        DARK_SLAYER,
        ABYSSAL_DRAGON,
        TURRET,
        BASE,
        OTHER
    }

    /** A participant position inside one game, independent of which player filled it. */
    public record Seat(
            Side side,
            Lane lane
    ) {
    }

    /** A broadcast stoppage: the game clock holds at {@code atSeconds} for {@code durationSeconds} of video. */
    public record VodPause(
            Integer atSeconds,
            Integer durationSeconds
    ) {
    }

    /**
     * An observed moment on the game clock. Kills use killer/victim/assists, objectives use side/objective/by and
     * notes use title with an optional side. Equipment changes stay in each participant's equipment events.
     */
    public record TimelineEvent(
            String id,
            Integer atSeconds,
            TimelineKind kind,
            Seat killer,
            Seat victim,
            List<Seat> assists,
            Side side,
            ObjectiveKind objective,
            Seat by,
            String title,
            String note
    ) {
        public TimelineEvent {
            assists = assists == null ? List.of() : List.copyOf(assists);
            title = title == null ? null : title.strip();
            note = note == null ? null : note.strip();
        }
    }

    public record GameTimeline(
            List<VodPause> pauses,
            List<TimelineEvent> events
    ) {
        public static final GameTimeline EMPTY = new GameTimeline(List.of(), List.of());

        public GameTimeline {
            pauses = pauses == null ? List.of() : List.copyOf(pauses);
            events = events == null ? List.of() : List.copyOf(events);
        }
    }

    public enum DraftKind {
        BAN,
        PICK
    }

    /** One ban/pick turn in the order it was taken; {@code atSecond} is a position in the game video. */
    public record DraftTurn(
            Integer order,
            DraftKind kind,
            Side side,
            Selection hero,
            Integer atSecond
    ) {
    }

    /**
     * The ban/pick phase as seen in the game video: when it starts, the turns in order and when line-ups are locked
     * after teammates swap heroes. Times are video seconds of the game source, like the game start.
     */
    public record GameDraft(
            Integer startSecond,
            Integer lockedSecond,
            List<DraftTurn> turns
    ) {
        public static final GameDraft EMPTY = new GameDraft(null, null, List.of());

        public GameDraft {
            turns = turns == null ? List.of() : List.copyOf(turns);
        }
    }

    public record Game(
            UUID seriesId,
            Integer number,
            String region,
            String locale,
            UUID seasonId,
            UUID patchVariantId,
            Instant startedAt,
            Integer durationSeconds,
            Side winner,
            String sourceUrl,
            Integer sourceTimestampSeconds,
            String note,
            List<GameSide> sides,
            boolean includeUnscoped,
            GameTimeline timeline,
            GameDraft draft
    ) {
        public Game {
            sides = sides == null ? List.of() : List.copyOf(sides);
            timeline = timeline == null ? GameTimeline.EMPTY : timeline;
            draft = draft == null ? GameDraft.EMPTY : draft;
        }

        public Game(UUID seriesId, Integer number, String region, String locale, UUID seasonId, UUID patchVariantId,
                Instant startedAt, Integer durationSeconds, Side winner, String sourceUrl,
                Integer sourceTimestampSeconds, String note, List<GameSide> sides, boolean includeUnscoped,
                GameTimeline timeline) {
            this(seriesId, number, region, locale, seasonId, patchVariantId, startedAt, durationSeconds, winner,
                    sourceUrl, sourceTimestampSeconds, note, sides, includeUnscoped, timeline, null);
        }

        public Game(UUID seriesId, Integer number, String region, String locale, UUID seasonId, UUID patchVariantId,
                Instant startedAt, Integer durationSeconds, Side winner, String sourceUrl,
                Integer sourceTimestampSeconds, String note, List<GameSide> sides, boolean includeUnscoped) {
            this(seriesId, number, region, locale, seasonId, patchVariantId, startedAt, durationSeconds, winner,
                    sourceUrl, sourceTimestampSeconds, note, sides, includeUnscoped, null, null);
        }
    }

    public record Reference(
            UUID id,
            String code,
            String name,
            String iconUrl,
            Integer tier,
            String color,
            String branchCode,
            UUID revisionId
    ) {
    }

    public record Catalog(
            List<Reference> heroes,
            List<Reference> items,
            List<Reference> arcana,
            List<Reference> enchantments,
            List<Reference> spells,
            ResolvedContext resolvedContext
    ) {
        public Catalog {
            heroes = List.copyOf(heroes);
            items = List.copyOf(items);
            arcana = List.copyOf(arcana);
            enchantments = List.copyOf(enchantments);
            spells = List.copyOf(spells);
        }
    }

    public record ResolvedContext(
            String region,
            String locale,
            UUID rulesetId,
            UUID seasonId,
            String seasonName,
            UUID patchVariantId,
            String patchCode,
            String patchTitle,
            boolean unknown,
            boolean includeUnscoped
    ) {
    }

    public record PublishedGame(
            UUID id,
            Instant publishedAt,
            Game content,
            Map<UUID, Team> teams,
            Map<UUID, Player> players,
            Catalog catalog,
            Series series,
            Tournament tournament,
            ResolvedContext resolvedContext
    ) {
    }
}
