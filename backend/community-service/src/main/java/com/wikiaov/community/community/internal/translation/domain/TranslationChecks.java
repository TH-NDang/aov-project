package com.wikiaov.community.community.internal.translation.domain;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;

/**
 * Checks a model's answer before it is kept. Each failure is a plain sentence the retry sends back to the model, so a
 * check never needs a second model to judge it.
 */
public final class TranslationChecks {
    private static final Pattern REF = Pattern.compile("<ref=[^>]{1,200}>.*?</ref>", Pattern.DOTALL);
    private static final Pattern QUOTED = Pattern.compile("\"[^\"]{0,200}\"|“[^”]{0,200}”|«[^»]{0,200}»");
    /** Short names in capitals, such as tournaments and teams (AOG, FPT), are written the same everywhere. */
    private static final Pattern ACRONYM = Pattern
            .compile("(?<![\\p{L}\\p{N}])\\p{Lu}[\\p{Lu}\\p{N}]+(?![\\p{L}\\p{N}])");

    private TranslationChecks() {
    }

    /** The post as it was sent: what the answer is checked against. */
    public record Source(
            @Nullable String title,
            String body,
            int images
    ) {
    }

    public static List<String> failures(Source source, TranslatedPost answer, String target, List<Glossary.Line> lines,
            Set<String> keptNames) {
        var failures = new ArrayList<String>();
        String language = TranslationLanguages.name(target);

        int missing = missingRefs(join(source.title(), source.body()), join(answer.title(), answer.body()));
        if (missing > 0) {
            failures.add("Keep every <ref=...>...</ref> tag exactly as in the post; " + missing
                    + " tag(s) are missing or changed.");
        }

        if (source.title() != null && !source.title().isBlank()
                && (answer.title() == null || answer.title().isBlank())) {
            failures.add("Translate the title too.");
        }
        if (wrongLanguage(answer.title(), target, keptNames)) {
            failures.add("Write the title in " + language + " only.");
        }
        if (wrongLanguage(answer.body(), target, keptNames)) {
            failures.add("Write the body in " + language + " only.");
        }

        String written = join(join(answer.title(), answer.body()), String.join("\n", answer.images().stream()
                .map(image -> image.text() == null ? "" : image.text()).toList()));
        for (var line : lines) {
            if (line.strict() && !uses(written, line, target)) {
                failures.add("Use the glossary term \"" + line.target() + "\" for \"" + line.source() + "\".");
            }
        }

        if (answer.images().size() != source.images()) {
            failures.add("Give exactly one image entry for each of the " + source.images() + " image(s), in order.");
        }
        for (var image : answer.images()) {
            if (image.hasText() && (image.text() == null || image.text().isBlank())) {
                failures.add("Image " + (image.index() + 1) + " has text: say in " + language + " what it says.");
            } else if (wrongLanguage(image.text(), target, keptNames)) {
                failures.add("Write the text of image " + (image.index() + 1) + " in " + language + " only.");
            }
        }
        return List.copyOf(failures);
    }

    /** How many reference tags of the source the answer lost or changed, counted as a multiset. */
    static int missingRefs(String source, String answer) {
        var wanted = new HashMap<String, Integer>();
        tags(source).forEach(tag -> wanted.merge(tag, 1, Integer::sum));
        for (String tag : tags(answer)) {
            wanted.computeIfPresent(tag, (ignored, count) -> count == 1 ? null : count - 1);
        }
        return wanted.values().stream().mapToInt(Integer::intValue).sum();
    }

    /**
     * Whether a text reads in another language than the target. Quotes, links, reference tags, names kept in every
     * language and capital-letter acronyms are left out first.
     */
    static boolean wrongLanguage(@Nullable String text, String target, Set<String> keptNames) {
        if (text == null || text.isBlank()) {
            return false;
        }
        String value = Glossary.nfc(text);
        value = REF.matcher(value).replaceAll(" ");
        value = QUOTED.matcher(value).replaceAll(" ");
        value = ACRONYM.matcher(PostLanguage.plain(value)).replaceAll(" ").toLowerCase(Locale.ROOT);
        for (String name : keptNames) {
            if (name.length() >= 3) {
                value = value.replace(Glossary.nfc(name).toLowerCase(Locale.ROOT), " ");
            }
        }

        boolean thai = PostLanguage.hasThai(value);
        int words = PostLanguage.words(value);
        double vietnamese = PostLanguage.vietnameseShare(value);
        return switch (target) {
            case "en-US", "id-ID" -> thai || (words >= 3 && vietnamese > 0.10);
            case "vi-VN" -> thai || (words > 8 && vietnamese < 0.15);
            case "th-TH" -> words > 8 && !thai;
            default -> false;
        };
    }

    /** Whether the answer writes the target term or one of its aliases; English may inflect it. */
    static boolean uses(String written, Glossary.Line line, String target) {
        var names = new ArrayList<String>();
        names.add(line.target());
        names.addAll(line.targetAliases());
        String value = Glossary.nfc(written);
        for (String name : names) {
            if (name.isBlank()) {
                continue;
            }
            if (value.toLowerCase(Locale.ROOT).contains(Glossary.nfc(name).toLowerCase(Locale.ROOT))) {
                return true;
            }
            if (target.equals("en-US") && inflected(name).matcher(value).find()) {
                return true;
            }
        }
        return false;
    }

    /** "carry" also matches "carried" and "carrying"; "poke" matches "poked" and "pokes". */
    private static Pattern inflected(String name) {
        var words = name.strip().split("\\s+");
        var parts = new ArrayList<String>();
        for (String word : words) {
            String stem = word.length() > 3 && (word.endsWith("y") || word.endsWith("e"))
                    ? word.substring(0, word.length() - 1)
                    : word;
            parts.add(Pattern.quote(stem) + "\\p{L}{0,4}");
        }
        return Pattern.compile("(?<![\\p{L}\\p{N}])" + String.join("\\s+", parts) + "(?![\\p{L}\\p{N}])",
                Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    }

    private static List<String> tags(String text) {
        var tags = new ArrayList<String>();
        Matcher matcher = REF.matcher(text);
        while (matcher.find()) {
            tags.add(matcher.group());
        }
        return tags;
    }

    private static String join(@Nullable String first, @Nullable String second) {
        return (first == null ? "" : first) + "\n" + (second == null ? "" : second);
    }
}
