package com.wikiaov.community.community.internal.translation.domain;

import java.util.List;

/** The languages a post can be written in, and how the prompt names a target language. */
public final class TranslationLanguages {
    /** Values the model may report as a post's language; {@code other} covers the rest. */
    public static final List<String> SOURCES = List.of("vi-VN", "en-US", "th-TH", "zh-TW", "id-ID", "other");

    private TranslationLanguages() {
    }

    public static String name(String tag) {
        return switch (tag) {
            case "vi-VN" -> "Vietnamese";
            case "en-US" -> "English";
            case "th-TH" -> "Thai";
            case "zh-TW" -> "Traditional Chinese";
            case "id-ID" -> "Indonesian";
            default -> throw new IllegalArgumentException("No translation into " + tag + ".");
        };
    }

    /** How readers of the language write numbers and dates, for the prompt. */
    static String numbers(String tag) {
        return switch (tag) {
            case "en-US" -> "13,888 and 49.4%; Nov 29";
            case "vi-VN" -> "13.888 và 49,4%; 29/11";
            case "th-TH" -> "13,888 และ 49.4%; 29 พ.ย.";
            case "zh-TW" -> "13,888 與 49.4%; 11月29日";
            case "id-ID" -> "13.888 dan 49,4%; 29 Nov";
            default -> throw new IllegalArgumentException("No translation into " + tag + ".");
        };
    }
}
