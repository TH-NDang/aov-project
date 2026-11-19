package com.wikiaov.community.tournament.internal.directory.application;

/** What the player directory is narrowed and ordered by; an empty text leaves its filter out. */
public record PlayerFilter(
        String q,
        String country,
        String lane,
        String status,
        String sort
) {
}
