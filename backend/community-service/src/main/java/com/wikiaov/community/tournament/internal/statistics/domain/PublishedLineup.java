package com.wikiaov.community.tournament.internal.statistics.domain;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.BuildPlace;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.DraftTurn;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Lane;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Selection;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Side;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import org.jspecify.annotations.Nullable;

/**
 * A published game cut down to what the statistics of its competition read: who picked and banned what and how it
 * ended. {@code players} are the nicknames and {@code catalog} the part of the catalog published with it.
 */
public record PublishedLineup(
        UUID id,
        Instant publishedAt,
        UUID seriesId,
        @Nullable Integer number,
        @Nullable Side winner,
        @Nullable Integer durationSeconds,
        @Nullable UUID mvpPlayerId,
        List<LineupSide> sides,
        List<DraftTurn> turns,
        Map<UUID, @Nullable String> players,
        Catalog catalog
) {
    /** An inventory shown this close to the end of a game is the one it ended with. */
    private static final int END_SECONDS = 60;

    public PublishedLineup {
        // Zero seconds is a length nobody filled in, not a game that ended at once.
        durationSeconds = durationSeconds == null || durationSeconds <= 0 ? null : durationSeconds;
        sides = sides == null ? List.of() : sides;
        turns = turns == null ? List.of() : turns;
        players = players == null ? Map.of() : players;
        catalog = catalog == null ? Catalog.EMPTY : catalog;
    }

    /** Whether the source showed who was banned; a game without a single ban is one whose bans nobody wrote down. */
    public boolean showsBans() {
        return sides.stream().flatMap(side -> side.bans().stream())
                .anyMatch(ban -> ban != null && ban.present());
    }

    /**
     * The items of one place in what a seat built. A build nobody wrote down is the inventory the game ended with; one
     * shown earlier says nothing about the end.
     */
    public List<Selection> items(Seat seat, BuildPlace place) {
        if (!seat.build().isEmpty()) {
            return seat.build().stream().filter(step -> step.place() == place).map(SeatItem::item).toList();
        }
        if (place != BuildPlace.KEPT || !shownAtTheEnd(seat.inventory())) {
            return List.of();
        }
        return seat.inventory().slots().stream().filter(SeatSlot::known).map(SeatSlot::item).toList();
    }

    private boolean shownAtTheEnd(@Nullable SeatInventory inventory) {
        return inventory != null && inventory.atSeconds() != null && durationSeconds != null
                && inventory.atSeconds() >= durationSeconds - END_SECONDS;
    }

    /** What the game knew of the heroes and the equipment it names, as it was when it was published. */
    public record Catalog(
            List<Known> heroes,
            List<Known> spells,
            List<Known> enchantments,
            List<Known> items
    ) {
        public static final Catalog EMPTY = new Catalog(List.of(), List.of(), List.of(), List.of());

        public Catalog {
            heroes = heroes == null ? List.of() : heroes;
            spells = spells == null ? List.of() : spells;
            enchantments = enchantments == null ? List.of() : enchantments;
            items = items == null ? List.of() : items;
        }
    }

    /** {@code tier} is that of an item or an enchantment. */
    public record Known(
            UUID id,
            @Nullable String code,
            @Nullable String name,
            @Nullable String iconUrl,
            @Nullable Integer tier
    ) {
        /** The entry of a catalog that a selection names by its id. */
        public static Optional<Known> of(List<Known> catalog, Selection selection) {
            return catalog.stream().filter(known -> selection.id() != null && selection.id().equals(known.id()))
                    .findFirst();
        }

        /**
         * The name a game shows for a selection: the one of its catalog, otherwise the one recorded. Empty when the
         * game knows it by its id alone.
         */
        public static String nameOf(List<Known> catalog, Selection selection) {
            return Stream.concat(of(catalog, selection).map(Known::name).stream(), Stream.ofNullable(selection.name()))
                    .filter(Objects::nonNull).map(String::strip).filter(name -> !name.isEmpty()).findFirst().orElse("");
        }
    }

    /** A selection may be missing or empty: a ban that was not used or not seen. */
    public record LineupSide(
            Side side,
            @Nullable UUID teamId,
            List<@Nullable Selection> bans,
            List<Seat> seats
    ) {
        public LineupSide {
            bans = bans == null ? List.of() : bans;
            seats = seats == null ? List.of() : seats;
        }
    }

    /** {@code inventory} is the last one the source showed. */
    public record Seat(
            @Nullable Selection hero,
            @Nullable Lane lane,
            @Nullable UUID playerId,
            @Nullable Selection spell,
            List<SeatEnchantment> enchantments,
            @Nullable SeatInventory inventory,
            List<SeatItem> build
    ) {
        public Seat {
            enchantments = enchantments == null ? List.of() : enchantments;
            build = build == null ? List.of() : build;
        }
    }

    public record SeatInventory(
            @Nullable Integer atSeconds,
            List<SeatSlot> slots
    ) {
        public SeatInventory {
            slots = slots == null ? List.of() : slots;
        }
    }

    public record SeatEnchantment(
            @Nullable Selection selection,
            boolean primary,
            @Nullable Integer tier
    ) {
    }

    public record SeatSlot(
            @Nullable Selection item,
            boolean known
    ) {
    }

    public record SeatItem(
            @Nullable Selection item,
            @Nullable BuildPlace place
    ) {
    }
}
