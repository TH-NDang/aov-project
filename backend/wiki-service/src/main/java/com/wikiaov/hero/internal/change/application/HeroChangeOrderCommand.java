package com.wikiaov.hero.internal.change.application;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/** Every change set of a patch variant once, in the order the patch lists its heroes. */
public record HeroChangeOrderCommand(
        @NotNull @Size(max = HeroChangeOrderCommand.MAX_ENTRIES) List<@NotNull UUID> changeSetIds
) {
    /** More heroes than the game has, so a real patch always fits. */
    public static final int MAX_ENTRIES = 500;
}
