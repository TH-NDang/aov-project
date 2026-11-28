package com.wikiaov.video;

import java.util.Set;

/**
 * What a video is attached to. {@link #SKIN} lives under a hero and needs a subject key. Skills have no videos of their
 * own: a video about a hero's skills belongs to the hero's one list.
 */
public enum VideoSubjectKind {
    HERO,
    SKIN,
    ITEM,
    ENCHANTMENT,
    ARCANA,
    SPELL;

    private static final Set<VideoSubjectKind> KEYED = Set.of(SKIN);

    public boolean requiresKey() {
        return KEYED.contains(this);
    }
}
