package com.wikiaov.community.community.internal.translation.domain;

import java.text.Normalizer;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;

/**
 * Guesses the language of a text from its letters, without a model. It only tells Vietnamese, Thai, Chinese and
 * other Latin text apart, which is enough to skip translating a post into the language it is already written in.
 */
public final class PostLanguage {
    private static final Pattern REF = Pattern.compile("<ref=[^>]{1,200}>.*?</ref>", Pattern.DOTALL);
    private static final Pattern NOISE = Pattern.compile("https?://\\S+|[#@][\\p{L}\\p{N}_]+");
    private static final Pattern WORD = Pattern.compile("[\\p{L}]+");
    /** Letters only Vietnamese uses among the Latin languages players write in. */
    private static final Pattern VIETNAMESE = Pattern.compile(
            "[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private PostLanguage() {
    }

    /** The language tag, or null when the text has too few words to tell. */
    public static @Nullable String guess(String text) {
        var counts = count(text);
        if (counts.letters() == 0) {
            return null;
        }
        if (counts.thai() * 5 >= counts.letters()) {
            return "th-TH";
        }
        if (counts.han() * 5 >= counts.letters()) {
            return "zh-TW";
        }
        if (counts.words() < 3) {
            return null;
        }
        return counts.vietnameseWords() * 100 >= counts.words() * 15 ? "vi-VN" : "en-US";
    }

    /** The share of words written with Vietnamese letters, from 0 to 1. */
    static double vietnameseShare(String text) {
        var counts = count(text);
        return counts.words() == 0 ? 0 : (double) counts.vietnameseWords() / counts.words();
    }

    static int words(String text) {
        return count(text).words();
    }

    static boolean hasThai(String text) {
        return count(text).thai() > 0;
    }

    /** The words that tell the language: names in reference tags, links and hashtags are left out. */
    static String plain(String text) {
        String value = Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFC);
        value = REF.matcher(value).replaceAll(" ");
        return NOISE.matcher(value).replaceAll(" ");
    }

    private static Counts count(String text) {
        String value = plain(text);
        int letters = 0;
        int thai = 0;
        int han = 0;
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (!Character.isLetter(c)) {
                continue;
            }
            letters++;
            if (c >= '฀' && c <= '๿') {
                thai++;
            } else if (Character.UnicodeScript.of(c) == Character.UnicodeScript.HAN) {
                han++;
            }
        }
        int words = 0;
        int vietnamese = 0;
        var matcher = WORD.matcher(value);
        while (matcher.find()) {
            String word = matcher.group();
            if (word.codePoints().allMatch(cp -> Character.UnicodeScript.of(cp) == Character.UnicodeScript.LATIN)) {
                words++;
                if (VIETNAMESE.matcher(word).find()) {
                    vietnamese++;
                }
            }
        }
        return new Counts(letters, thai, han, words, vietnamese);
    }

    private record Counts(
            int letters,
            int thai,
            int han,
            int words,
            int vietnameseWords
    ) {
    }
}
