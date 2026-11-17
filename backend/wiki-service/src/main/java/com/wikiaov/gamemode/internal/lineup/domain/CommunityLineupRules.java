package com.wikiaov.gamemode.internal.lineup.domain;

import com.wikiaov.gamemode.internal.domain.AutoChessContent;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.LineupUnit;
import com.wikiaov.gamemode.internal.domain.ContentChecks;
import com.wikiaov.gamemode.internal.guide.domain.AutoChessContentRules;
import com.wikiaov.platform.ApiFieldError;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/** Limits of a lineup a reader saves from the builder (ADR-023). */
public final class CommunityLineupRules {
    public static final int MAX_NAME = 60;

    public static final int MAX_NOTE = 280;

    public static final int MAX_PER_AUTHOR = 30;

    private CommunityLineupRules() {
    }

    public static List<ApiFieldError> validate(String name, String note, List<LineupUnit> units,
            List<String> emblems, AutoChessContent guide) {
        var checks = new ContentChecks();
        var unitCodes = guide.units().stream().map(AutoChessContent.Unit::code).collect(Collectors.toSet());
        var itemCodes = guide.items().stream().map(AutoChessContent.Item::code).collect(Collectors.toSet());
        Set<String> traitCodes = guide.traits().stream().map(AutoChessContent.Trait::code)
                .collect(Collectors.toSet());

        checks.text("name", name == null ? null : name.strip(), MAX_NAME, true);
        checks.text("note", note, MAX_NOTE, false);
        if (units.isEmpty()) {
            checks.fail("units", "REQUIRED", "Add at least one unit.");
        }
        AutoChessContentRules.lineupUnits(checks, "units", units, unitCodes, itemCodes);
        checks.references("emblems", emblems, traitCodes, AutoChessContentRules.MAX_EMBLEMS);

        return checks.errors();
    }
}
