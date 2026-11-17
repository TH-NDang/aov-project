package com.wikiaov.hero.internal.application.response;

import java.util.List;
import java.util.UUID;

/** A hero and all its revisions, newest first. */
public record HeroStatusView(
        UUID id,
        List<HeroRevisionView> revisions
) {
}
