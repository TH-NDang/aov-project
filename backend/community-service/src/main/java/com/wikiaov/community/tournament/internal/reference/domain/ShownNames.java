package com.wikiaov.community.tournament.internal.reference.domain;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;

/** The other names of a record that may be shown. */
public final class ShownNames {
    private static final Pattern MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern SEPARATORS = Pattern.compile("[^\\p{L}\\p{N}]+");

    private ShownNames() {
    }

    /** {@code names} without blanks, repeats and those {@code shown} already. */
    public static List<String> others(Collection<String> names, @Nullable String... shown) {
        var taken = Arrays.stream(shown).filter(Objects::nonNull).collect(Collectors.toSet());

        return names.stream().filter(name -> name != null && !name.isBlank()).map(String::strip)
                .filter(name -> !taken.contains(name)).distinct().toList();
    }

    /**
     * A player's other names, without any drawn from the real name: one whose words are all words of it, with or
     * without accents, tells who the player is.
     */
    public static List<String> othersOfPlayer(Collection<String> names, String nickname, @Nullable String realName) {
        var real = words(realName);

        return others(names, nickname).stream().filter(name -> {
            var said = words(name);
            return said.isEmpty() || !real.containsAll(said);
        }).toList();
    }

    private static Set<String> words(@Nullable String name) {
        if (name == null) {
            return Set.of();
        }
        var plain = MARKS.matcher(Normalizer.normalize(name, Normalizer.Form.NFD)).replaceAll("")
                .replace('đ', 'd').replace('Đ', 'D').toLowerCase(Locale.ROOT);

        return SEPARATORS.splitAsStream(plain).filter(word -> !word.isEmpty())
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
