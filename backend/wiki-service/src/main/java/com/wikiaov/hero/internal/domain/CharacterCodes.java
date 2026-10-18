package com.wikiaov.hero.internal.domain;

import java.util.Map;

/** Known international hero identities, independent of the currently displayed translation. */
public final class CharacterCodes {
    private static final Map<String, String> HERO_CODES = Map.of("ngo-khong", "wukong", "dieu-thuyen", "diaochan",
            "trieu-van", "zanis", "lu-bo", "lu-bu", "richter", "riktor", "jinna", "jinnar");

    private CharacterCodes() {
    }

    public static String hero(String code) {
        return HERO_CODES.getOrDefault(code, code);
    }
}
