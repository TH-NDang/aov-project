package com.wikiaov.platform;

import java.util.UUID;

/** The answer of a command that creates something: the identifier of what it created, as {@code {"id": ...}}. */
public record CreatedId(
        UUID id
) {
}
