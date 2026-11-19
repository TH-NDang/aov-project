package com.wikiaov.community.tournament.internal.domain;

import com.wikiaov.community.tournament.internal.domain.CatalogContent.Catalog;
import com.wikiaov.community.tournament.internal.domain.CatalogContent.ResolvedContext;
import com.wikiaov.community.tournament.internal.domain.RosterContent.Lane;
import com.wikiaov.community.tournament.internal.domain.RosterContent.Player;
import com.wikiaov.community.tournament.internal.domain.RosterContent.Team;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The stored document of one recorded game: its two sides with bans, players, loadouts and equipment, the timeline on
 * the game clock and the draft on the game video. A published game is frozen with the records and catalog it names.
 */
public final class GameContent {
    private GameContent() {
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

    public record ArcanaAllocation(
            Selection selection,
            Integer count,
            String color
    ) {
    }

    /** An omitted {@code primary} flag means a secondary branch. */
    public record EnchantmentAllocation(
            Selection selection,
            Boolean primary,
            Integer tier,
            String branchCode
    ) {
        public EnchantmentAllocation {
            primary = Boolean.TRUE.equals(primary);
        }
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

    /** An omitted {@code known} flag means the slot was not readable in the source. */
    public record InventorySlot(
            Integer slot,
            Boolean known,
            Selection item
    ) {
        public InventorySlot {
            known = Boolean.TRUE.equals(known);
        }
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
            Boolean includeUnscoped,
            GameTimeline timeline,
            GameDraft draft
    ) {
        /** Clients may omit {@code includeUnscoped}; it then keeps the catalog to the game's season and patch. */
        public Game {
            includeUnscoped = Boolean.TRUE.equals(includeUnscoped);
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
