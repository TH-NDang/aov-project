package com.wikiaov.gamemode.internal.application;

import com.wikiaov.gamemode.internal.domain.AutoChessContent;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.LineupUnit;
import com.wikiaov.gamemode.internal.domain.AutoChessContentRules;
import com.wikiaov.gamemode.internal.domain.GameModeContent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

public final class GameModeCommands {
    private GameModeCommands() {
    }

    public record CreateMode(
            @NotBlank @Size(max = 120) @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") String code,
            @NotBlank @Size(max = 120) String name,
            @NotBlank @Pattern(regexp = "PVP|ENTERTAINMENT") String group,
            GameModeContent content
    ) {
    }

    public record CreateDraft(
            @Size(max = 4000) String changeNote
    ) {
    }

    public record UpdateMode(
            @NotNull @Positive Long expectedVersion,
            @NotNull GameModeContent content,
            @Size(max = 4000) String changeNote
    ) {
    }

    public record Mutation(
            @NotNull @Positive Long expectedVersion,
            @Size(max = 4000) String changeNote
    ) {
    }

    /** {@code content} seeds only the first guide draft of a mode, e.g. from an import. */
    public record CreateGuideDraft(
            @Size(max = 4000) String changeNote,
            AutoChessContent content
    ) {
    }

    public record UpdateGuide(
            @NotNull @Positive Long expectedVersion,
            @NotNull AutoChessContent content,
            @Size(max = 4000) String changeNote
    ) {
    }

    /** A reader's lineup from the builder. {@code expectedVersion} is required when it replaces a saved one. */
    public record SaveLineup(
            @Positive Long expectedVersion,
            @NotBlank @Size(max = 60) String name,
            @Size(max = 280) String note,
            @NotNull @Size(min = 1, max = AutoChessContentRules.MAX_LINEUP_UNITS) List<LineupUnit> units,
            @Size(max = 3) List<String> emblems
    ) {

        public SaveLineup {
            emblems = emblems == null ? List.of() : List.copyOf(emblems);
        }
    }

    public record Visibility(
            @NotNull @Positive Long expectedVersion,
            @NotNull Boolean hidden,
            @Size(max = 500) String reason
    ) {
    }
}
