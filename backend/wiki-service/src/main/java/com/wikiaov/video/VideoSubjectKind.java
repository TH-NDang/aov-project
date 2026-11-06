package com.wikiaov.video;

import java.util.Set;

/** What a video is attached to. {@link #SKILL} and {@link #SKIN} live under a hero and need a subject key. */
public enum VideoSubjectKind {
    HERO,
    SKILL,
    SKIN,
    ITEM,
    ENCHANTMENT,
    ARCANA,
    SPELL;

    private static final Set<VideoSubjectKind> KEYED = Set.of(SKILL, SKIN);

    public boolean requiresKey() {
        return KEYED.contains(this);
    }
}
