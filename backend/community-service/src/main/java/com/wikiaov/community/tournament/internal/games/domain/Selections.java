package com.wikiaov.community.tournament.internal.games.domain;

import com.wikiaov.community.tournament.internal.domain.CatalogContent.Reference;
import com.wikiaov.community.tournament.internal.domain.GameContent.Selection;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import org.jspecify.annotations.Nullable;

/** A hero, spell, arcana, enchantment or item named in a game, checked against the catalog of the game's patch. */
final class Selections {
    /** Names of picks and selections. */
    static final int MAX_NAME = 200;

    private Selections() {
    }

    static void check(@Nullable Selection selection, boolean required, String path, List<String> errors,
            @Nullable List<Reference> references) {
        if (!present(selection)) {
            if (required) {
                errors.add(path);
            }
            return;
        }
        if (selection.name() != null && selection.name().length() > MAX_NAME) {
            errors.add(path + ".name.length");
        }
        if (required && selection.id() != null && references != null && reference(selection, references) == null) {
            errors.add(path + ".unavailableInPatch");
        }
    }

    static @Nullable Reference reference(@Nullable Selection selection, @Nullable List<Reference> references) {
        return selection == null || selection.id() == null || references == null
                ? null
                : references.stream().filter(reference -> reference.id().equals(selection.id())).findFirst()
                        .orElse(null);
    }

    static boolean present(@Nullable Selection selection) {
        return selection != null && selection.present();
    }

    /** What makes two selections the same: the catalog id, or else the normalized name. */
    static String identity(Selection selection) {
        return selection.id() != null
                ? selection.id().toString()
                : Normalizer.normalize(selection.name().trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFKC);
    }
}
