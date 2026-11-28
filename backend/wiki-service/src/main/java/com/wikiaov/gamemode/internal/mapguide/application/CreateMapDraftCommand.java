package com.wikiaov.gamemode.internal.mapguide.application;

import com.wikiaov.gamemode.internal.domain.MapGuideContent;
import jakarta.validation.constraints.Size;

/** Opens a map draft. {@code content} seeds only the first draft of a mode, e.g. from an import. */
public record CreateMapDraftCommand(
        @Size(max = 4000) String changeNote,
        MapGuideContent content
) {
}
