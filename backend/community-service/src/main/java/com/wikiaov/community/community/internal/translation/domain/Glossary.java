package com.wikiaov.community.community.internal.translation.domain;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Game names in each language, from the shared terminology of wiki-service (ADR-011): terms editors keep in Admin and
 * the names of heroes, items, spells, arcana and enchantments. Only the entries a post uses go into its prompt, so a
 * small model reads a short list instead of the whole catalog.
 */
public final class Glossary {
    private static final Pattern REF = Pattern.compile("<ref=[^>]{1,200}>.*?</ref>", Pattern.DOTALL);
    /** Names of other kinds that also go into the prompt of a post with images, which may show any of them. */
    private static final int MAX_LABELS = 150;
    private static final Glossary EMPTY = new Glossary(List.of(), Set.of());

    /** A name and the other ways players write it, in one language. */
    public record Names(
            String name,
            List<String> aliases
    ) {
        public Names {
            name = nfc(name).strip();
            aliases = aliases == null
                    ? List.of()
                    : aliases.stream().map(Glossary::nfc).map(String::strip)
                            .filter(alias -> !alias.isBlank()).toList();
        }

        List<String> forms() {
            var forms = new ArrayList<String>();
            forms.add(name);
            forms.addAll(aliases);
            return forms;
        }
    }

    /** One entry of the shared terminology, keyed by kind and id, with its names by language tag. */
    public record Term(
            String key,
            String kind,
            Map<String, Names> names
    ) {
        public Term {
            names = Map.copyOf(names);
        }
    }

    /**
     * One prompt line: the words found in the post and the name to write instead. A strict line is checked in the
     * answer; a line whose source words have several meanings in the glossary is not.
     */
    public record Line(
            String termKey,
            String source,
            String target,
            List<String> targetAliases,
            boolean strict
    ) {
    }

    private final List<Term> terms;
    private final Set<String> keptNames;
    private final Map<String, Pattern> patterns = new HashMap<>();

    private Glossary(List<Term> terms, Set<String> keptNames) {
        this.terms = List.copyOf(terms);
        this.keptNames = Set.copyOf(keptNames);
        for (var term : this.terms) {
            for (var names : term.names().values()) {
                for (String form : names.forms()) {
                    if (form.length() >= 2) {
                        patterns.computeIfAbsent(form, Glossary::pattern);
                    }
                }
            }
        }
    }

    /**
     * @param keptNames
     *            names written the same in every language, such as heroes; the language check skips them
     */
    public static Glossary of(List<Term> terms, Set<String> keptNames) {
        return new Glossary(terms, keptNames);
    }

    public static Glossary empty() {
        return EMPTY;
    }

    public Set<String> keptNames() {
        return keptNames;
    }

    public int size() {
        return terms.size();
    }

    /**
     * The lines for a post written in any language other than {@code target}. Words inside reference tags are left
     * out, and where two entries overlap the longer one wins. With {@code labels} the terms an image may show are
     * added after the matches, unchecked.
     */
    public List<Line> lines(String text, String target, boolean labels) {
        String plain = REF.matcher(nfc(text)).replaceAll(" ");
        var ambiguous = ambiguousForms(target);
        var found = new ArrayList<Found>();
        for (var term : terms) {
            var wanted = term.names().get(target);
            if (wanted == null) {
                continue;
            }
            for (var entry : term.names().entrySet()) {
                if (entry.getKey().equals(target)) {
                    continue;
                }
                for (String form : entry.getValue().forms()) {
                    var pattern = patterns.get(form);
                    if (pattern == null || same(form, wanted.forms())) {
                        continue;
                    }
                    var matcher = pattern.matcher(plain);
                    while (matcher.find()) {
                        found.add(new Found(term, form, matcher.start(), matcher.end()));
                    }
                }
            }
        }

        found.sort(Comparator.comparingInt((Found f) -> f.end() - f.start()).reversed()
                .thenComparingInt(Found::start));
        var taken = new ArrayList<Found>();
        var lines = new LinkedHashMap<String, Line>();
        for (var candidate : found) {
            if (taken.stream().anyMatch(other -> candidate.start() < other.end() && other.start() < candidate.end())) {
                continue;
            }
            taken.add(candidate);
            var wanted = candidate.term().names().get(target);
            lines.putIfAbsent(candidate.term().key(), new Line(candidate.term().key(), candidate.form(),
                    wanted.name(), wanted.aliases(),
                    !ambiguous.contains(candidate.form().toLowerCase(Locale.ROOT))));
        }
        var ordered = new ArrayList<>(lines.values());
        ordered.sort(Comparator.comparingInt(line -> plain.indexOf(line.source())));

        if (labels) {
            int added = 0;
            for (var term : terms) {
                if (added >= MAX_LABELS) {
                    break;
                }
                var wanted = term.names().get(target);
                var source = sourceName(term, target);
                if (!term.kind().equals("term") || wanted == null || source == null || lines.containsKey(term.key())
                        || source.equalsIgnoreCase(wanted.name())) {
                    continue;
                }
                ordered.add(new Line(term.key(), source, wanted.name(), wanted.aliases(), false));
                added++;
            }
        }
        return List.copyOf(ordered);
    }

    /** Source words that the glossary turns into different target names, such as an item and an effect alike. */
    private Set<String> ambiguousForms(String target) {
        var targets = new HashMap<String, Set<String>>();
        for (var term : terms) {
            var wanted = term.names().get(target);
            if (wanted == null) {
                continue;
            }
            for (var entry : term.names().entrySet()) {
                if (entry.getKey().equals(target)) {
                    continue;
                }
                for (String form : entry.getValue().forms()) {
                    targets.computeIfAbsent(form.toLowerCase(Locale.ROOT), ignored -> new HashSet<>())
                            .add(wanted.name().toLowerCase(Locale.ROOT));
                }
            }
        }
        var ambiguous = new HashSet<String>();
        targets.forEach((form, names) -> {
            if (names.size() > 1) {
                ambiguous.add(form);
            }
        });
        return ambiguous;
    }

    /** The Vietnamese name when there is one, as the site is written in Vietnamese first. */
    private static String sourceName(Term term, String target) {
        var vietnamese = term.names().get("vi-VN");
        if (vietnamese != null && !target.equals("vi-VN")) {
            return vietnamese.name();
        }
        return term.names().entrySet().stream().filter(entry -> !entry.getKey().equals(target))
                .map(entry -> entry.getValue().name()).findFirst().orElse(null);
    }

    private static boolean same(String form, List<String> targets) {
        return targets.stream().anyMatch(target -> target.equalsIgnoreCase(form));
    }

    /**
     * Words in Latin letters match whole words only; Thai and Chinese have no spaces, so they match anywhere. A form
     * written in lower case matches any case. A form with a capital after its first letter, such as a rank, matches
     * only that way, so a rank name written in capitals does not catch the same everyday word in lower case.
     */
    static Pattern pattern(String form) {
        boolean latin = form.codePoints().filter(Character::isLetter)
                .allMatch(cp -> Character.UnicodeScript.of(cp) == Character.UnicodeScript.LATIN);
        String rest = form.substring(1);
        boolean cased = !rest.equals(rest.toLowerCase(Locale.ROOT));
        String body = cased
                ? "(?iu:" + Pattern.quote(form.substring(0, 1)) + ")" + Pattern.quote(rest)
                : Pattern.quote(form);
        String bounded = latin ? "(?<![\\p{L}\\p{N}])" + body + "(?![\\p{L}\\p{N}])" : body;
        return Pattern.compile(bounded, cased ? 0 : Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    }

    static String nfc(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFC);
    }

    private record Found(
            Term term,
            String form,
            int start,
            int end
    ) {
    }
}
