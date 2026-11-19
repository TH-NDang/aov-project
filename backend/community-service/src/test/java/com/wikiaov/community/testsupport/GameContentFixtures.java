package com.wikiaov.community.testsupport;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.Reference;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Selection;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** Selections and catalog references of a recorded game that point at each other through the same number. */
public final class GameContentFixtures {
    private GameContentFixtures() {
    }

    /** The same number always gives the same id. */
    public static UUID id(int value) {
        return new UUID(0, value);
    }

    public static Selection selection(int value) {
        return new Selection(id(value), "entry-" + value);
    }

    /** A selection the source named without a catalog id. */
    public static Selection named(String name) {
        return new Selection(null, name);
    }

    public static Reference reference(int value, @Nullable Integer tier, @Nullable String color,
            @Nullable String branch) {
        return new Reference(id(value), "entry-" + value, "Entry " + value, null, tier, color, branch,
                id(value + 2000));
    }
}
