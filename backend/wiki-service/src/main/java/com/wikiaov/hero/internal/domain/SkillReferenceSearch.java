package com.wikiaov.hero.internal.domain;

import java.text.Normalizer;
import java.util.*;
import java.util.regex.Pattern;

/** Source slots are explicit identifiers, never inferred from array positions or translated names. */
public record SkillReferenceSearch(
        List<String> words,
        Integer sourceSlot,
        Integer variantNo
) {
    private static final Pattern SLOT = Pattern
            .compile("\\b(?:chieu(?:\\s+thuc)?|ky\\s+nang|skills?)\\s*([0-9]{1,2})(?:\\s+([0-9]{1,3}))?\\b");
    private static final Pattern PASSIVE = Pattern.compile("\\b(?:noi\\s*tai|passive)\\b");
    private static final Pattern CATEGORY = Pattern.compile("\\b(?:ky\\s+nang|chieu\\s+thuc|chieu|skills?)\\b");
    private static final Pattern SOURCE_KEY = Pattern.compile("skill-([0-9]+)-([0-9]+)");
    private static final Pattern CAPTURE_KEY = Pattern.compile("capture-skill-([0-9]+)");
    public static final String DIACRITICS = "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ";
    public static final String PLAIN = "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd";

    public static SkillReferenceSearch parse(String q) {
        String value = normalize(q);
        Integer slot = null, variant = null;
        var numbered = SLOT.matcher(value);
        if (numbered.find()) {
            slot = Integer.valueOf(numbered.group(1));
            variant = numbered.group(2) == null ? null : Integer.valueOf(numbered.group(2));
            value = numbered.replaceFirst(" ");
        } else {
            var passive = PASSIVE.matcher(value);
            if (passive.find()) {
                slot = 0;
                value = passive.replaceFirst(" ");
            }
        }
        value = CATEGORY.matcher(value).replaceAll(" ").replace('@', ' ');
        return new SkillReferenceSearch(Arrays.stream(value.strip().split("\\s+")).filter(s -> !s.isEmpty()).toList(),
                slot, variant);
    }
    public static String normalize(String value) {
        return Normalizer.normalize(value.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").replace('đ', 'd');
    }
    public static Integer sourceSlot(String skillKey) {
        var source = SOURCE_KEY.matcher(skillKey);
        if (source.matches())
            return number(source.group(1));
        if (skillKey.equals("capture-passive"))
            return 0;
        var capture = CAPTURE_KEY.matcher(skillKey);
        return capture.matches() ? number(capture.group(1)) : null;
    }
    public static Integer variantNo(String skillKey) {
        var source = SOURCE_KEY.matcher(skillKey);
        return source.matches() ? number(source.group(2)) : null;
    }
    private static Integer number(String value) {
        try {
            return Integer.valueOf(value);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
