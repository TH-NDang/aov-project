package com.wikiaov.community.tournament.internal.domain;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.BuildPlace;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.BuildStep;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Selection;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.jspecify.annotations.Nullable;

/**
 * What became of the items of a build, read from the steps after each one: an item a later step grew from went into
 * it, one a later step replaces was sold for it, and the rest were held to the end unless marked sold. Nothing of this
 * is written down, so the steps cannot say it twice.
 */
public final class BuildPath {
    /** What became of an item: held when the game ended, gone into a later item, or sold. */
    public enum Fate {
        HELD,
        UPGRADED,
        SOLD
    }

    private BuildPath() {
    }

    /** What makes two selections the same item: the wiki entry, or the name typed by hand. */
    public static String key(Selection selection) {
        if (selection.id() != null) {
            return selection.id().toString();
        }
        String name = selection.name() == null ? "" : selection.name();
        return Normalizer.normalize(name.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFKC);
    }

    /** What became of each step, in the order of the steps. */
    public static List<Fate> fates(List<BuildStep> steps) {
        var fates = new ArrayList<Fate>(steps.size());
        for (int index = 0; index < steps.size(); index++) {
            fates.add(fate(steps, index));
        }
        return List.copyOf(fates);
    }

    /** The step whose item a later step grew from or replaced, or -1 while it is held or sold for nothing recorded. */
    public static int successor(List<BuildStep> steps, int index) {
        var step = steps.get(index);
        if (!present(step.item())) {
            return -1;
        }
        String key = key(step.item());
        for (int later = index + 1; later < steps.size(); later++) {
            var next = steps.get(later);
            if (names(next.from(), key) || names(next.replaces(), key)) {
                return later;
            }
        }
        return -1;
    }

    /**
     * A list as it is written now. The first lists put an item given up among the "replaced" ones; such an item went into
     * a later one if a later step grew from it, and was sold otherwise.
     */
    public static List<BuildStep> current(List<BuildStep> steps) {
        if (steps.stream().allMatch(step -> step.place() == null)) {
            return List.copyOf(steps);
        }

        var current = new ArrayList<BuildStep>(steps.size());
        for (int index = 0; index < steps.size(); index++) {
            var step = steps.get(index);
            boolean sold = step.sold() || step.place() == BuildPlace.REPLACED && successor(steps, index) < 0;
            current.add(new BuildStep(step.item(), step.from(), step.replaces(), step.role(), sold, step.atSeconds()));
        }
        return List.copyOf(current);
    }

    private static Fate fate(List<BuildStep> steps, int index) {
        int next = successor(steps, index);
        if (next >= 0) {
            String key = key(steps.get(index).item());
            return names(steps.get(next).from(), key) ? Fate.UPGRADED : Fate.SOLD;
        }
        return steps.get(index).sold() ? Fate.SOLD : Fate.HELD;
    }

    private static boolean names(List<Selection> selections, String key) {
        return selections.stream().anyMatch(selection -> present(selection) && key(selection).equals(key));
    }

    private static boolean present(@Nullable Selection selection) {
        return selection != null && selection.present();
    }
}
