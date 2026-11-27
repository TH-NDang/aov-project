package com.wikiaov.gamemode.internal.mapguide.domain;

import com.wikiaov.gamemode.internal.catalog.domain.GameModeContentRules;
import com.wikiaov.gamemode.internal.domain.ContentChecks;
import com.wikiaov.gamemode.internal.domain.MapGuideContent;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.Lane;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.MapObject;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.Point;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.Section;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.TempoMoment;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.Timing;
import com.wikiaov.platform.ApiFieldError;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Structural and reference rules of a battlefield map snapshot (spec 01, game modes section). */
public final class MapGuideContentRules {
    public static final Set<String> CATEGORIES = Set.of("STRUCTURE", "MINION", "MONSTER", "EPIC", "MECHANIC");

    /** Symbols the Wiki draws for map objects. */
    public static final Set<String> GLYPHS = Set.of("ALTAR", "BASE", "TOWER", "MINION", "RANGED", "SIEGE", "SUPER",
            "VANGUARD", "MONSTER", "GIANT", "DRAGON", "CAESAR", "BOSS", "KONG", "EYE", "HEAL", "BUSH", "PORTAL");

    public static final Set<String> LANE_GLYPHS = Set.of("LANE", "JUNGLE", "MID", "SUPPORT");

    public static final int MAX_OBJECTS = 120;

    public static final int MAX_POSITIONS = 12;

    /** Spawn times and the timeline stop at two hours, well past any real match. */
    public static final int MAX_SECONDS = 7200;

    private MapGuideContentRules() {
    }

    /** Errors that block saving. Missing data is allowed in a draft; broken references are not. */
    public static List<ApiFieldError> validate(MapGuideContent content) {
        var checks = new ContentChecks();

        checks.text("name", content.name(), 120, false);
        checks.text("summary", content.summary(), 2000, false);
        var codes = objects(checks, content.objects());
        lanes(checks, content.lanes());
        tempo(checks, content.tempo(), codes);
        GameModeContentRules.sources(checks, "sources", content.sources());

        return checks.errors();
    }

    /** Fields that must be filled before publication. */
    public static List<String> missingFields(MapGuideContent content) {
        var missing = new ArrayList<String>();
        if (content.name() == null || content.name().isBlank()) {
            missing.add("name");
        }
        if (content.objects().isEmpty()) {
            missing.add("objects");
        }
        for (int i = 0; i < content.objects().size(); i++) {
            var object = content.objects().get(i);
            if (object != null && object.family() == null && object.positions().isEmpty()) {
                missing.add("objects[" + i + "].positions");
            }
        }
        return missing;
    }

    /** Every asset the snapshot refers to. */
    public static Set<UUID> assets(MapGuideContent content) {
        var ids = new LinkedHashSet<UUID>();
        if (content.backgroundAssetId() != null) {
            ids.add(content.backgroundAssetId());
        }
        return ids;
    }

    private static Set<String> objects(ContentChecks checks, List<MapObject> objects) {
        checks.size("objects", objects, MAX_OBJECTS);
        var codes = new HashSet<String>();
        var families = new HashMap<String, String>();
        for (int i = 0; i < objects.size(); i++) {
            var object = objects.get(i);
            String at = "objects[" + i + "]";
            if (object == null) {
                checks.fail(at, "REQUIRED", "An object entry is required.");
                continue;
            }
            checks.code(at + ".code", object.code(), codes);
            checks.text(at + ".name", object.name(), 120, true);
            checks.oneOf(at + ".category", object.category(), CATEGORIES, true);
            checks.oneOf(at + ".glyph", object.glyph(), GLYPHS, false);
            checks.text(at + ".summary", object.summary(), 300, false);
            checks.size(at + ".tags", object.tags(), 6);
            for (int t = 0; t < object.tags().size(); t++) {
                checks.text(at + ".tags[" + t + "]", object.tags().get(t), 40, true);
            }
            timing(checks, at + ".firstSpawn", object.firstSpawn());
            timing(checks, at + ".respawn", object.respawn());
            sections(checks, at + ".sections", object.sections());
            if (object.change() != null) {
                section(checks, at + ".change", object.change());
            }
            points(checks, at + ".positions", object.positions(), MAX_POSITIONS);
            if (object.family() != null && object.code() != null) {
                families.put(object.code(), object.family());
            }
        }

        // A family points at another object that heads a family itself, so forms never nest.
        for (int i = 0; i < objects.size(); i++) {
            var object = objects.get(i);
            if (object == null || object.family() == null) {
                continue;
            }
            String at = "objects[" + i + "].family";
            if (!codes.contains(object.family()) || object.family().equals(object.code())) {
                checks.fail(at, "UNKNOWN_REFERENCE", "No other object has this code.");
            } else if (families.containsKey(object.family())) {
                checks.fail(at, "NESTED_FAMILY", "Point at the family head, not at one of its forms.");
            }
        }

        return codes;
    }

    private static void lanes(ContentChecks checks, List<Lane> lanes) {
        checks.size("lanes", lanes, 10);
        var codes = new HashSet<String>();
        for (int i = 0; i < lanes.size(); i++) {
            var lane = lanes.get(i);
            String at = "lanes[" + i + "]";
            if (lane == null) {
                checks.fail(at, "REQUIRED", "A lane entry is required.");
                continue;
            }
            checks.code(at + ".code", lane.code(), codes);
            checks.text(at + ".name", lane.name(), 120, true);
            checks.oneOf(at + ".glyph", lane.glyph(), LANE_GLYPHS, false);
            checks.text(at + ".body", lane.body(), 4000, false);
            checks.size(at + ".heroCodes", lane.heroCodes(), 30);
            var heroes = new HashSet<String>();
            for (int h = 0; h < lane.heroCodes().size(); h++) {
                checks.code(at + ".heroCodes[" + h + "]", lane.heroCodes().get(h), heroes);
            }
            points(checks, at + ".positions", lane.positions(), 4);
            points(checks, at + ".path", lane.path(), 12);
        }
    }

    private static void tempo(ContentChecks checks, List<TempoMoment> tempo, Set<String> objectCodes) {
        checks.size("tempo", tempo, 20);
        var seen = new HashSet<Integer>();
        Integer previous = null;
        for (int i = 0; i < tempo.size(); i++) {
            var moment = tempo.get(i);
            String at = "tempo[" + i + "]";
            if (moment == null) {
                checks.fail(at, "REQUIRED", "A timeline entry is required.");
                continue;
            }
            checks.range(at + ".seconds", moment.seconds(), 0, MAX_SECONDS, true);
            if (moment.seconds() != null) {
                if (!seen.add(moment.seconds())) {
                    checks.fail(at + ".seconds", "DUPLICATE_TIME", "Another timeline entry has this time.");
                } else if (previous != null && moment.seconds() < previous) {
                    checks.fail(at + ".seconds", "OUT_OF_ORDER", "List the timeline in ascending time.");
                }
                previous = moment.seconds();
            }
            checks.text(at + ".phase", moment.phase(), 40, false);
            checks.size(at + ".callouts", moment.callouts(), 8);
            for (int c = 0; c < moment.callouts().size(); c++) {
                var callout = moment.callouts().get(c);
                String calloutAt = at + ".callouts[" + c + "]";
                if (callout == null) {
                    checks.fail(calloutAt, "REQUIRED", "A callout entry is required.");
                    continue;
                }
                checks.text(calloutAt + ".label", callout.label(), 80, true);
                if (callout.objectCode() != null && !objectCodes.contains(callout.objectCode())) {
                    checks.fail(calloutAt + ".objectCode", "UNKNOWN_REFERENCE", "No object has this code.");
                }
                point(checks, calloutAt, new Point(callout.x(), callout.y()));
            }
            checks.size(at + ".steps", moment.steps(), 10);
            for (int s = 0; s < moment.steps().size(); s++) {
                checks.text(at + ".steps[" + s + "]", moment.steps().get(s), 1000, true);
            }
        }
    }

    private static void timing(ContentChecks checks, String path, Timing timing) {
        if (timing == null) {
            return;
        }
        checks.range(path + ".seconds", timing.seconds(), 0, MAX_SECONDS, false);
        checks.text(path + ".note", timing.note(), 500, false);
        if (timing.seconds() == null && (timing.note() == null || timing.note().isBlank())) {
            checks.fail(path, "REQUIRED", "Give the time in seconds or describe it.");
        }
    }

    private static void sections(ContentChecks checks, String path, List<Section> sections) {
        checks.size(path, sections, 12);
        for (int i = 0; i < sections.size(); i++) {
            var section = sections.get(i);
            if (section == null) {
                checks.fail(path + "[" + i + "]", "REQUIRED", "A section entry is required.");
                continue;
            }
            section(checks, path + "[" + i + "]", section);
        }
    }

    private static void section(ContentChecks checks, String path, Section section) {
        checks.text(path + ".title", section.title(), 120, true);
        checks.text(path + ".body", section.body(), 4000, true);
    }

    private static void points(ContentChecks checks, String path, List<Point> points, int max) {
        checks.size(path, points, max);
        for (int i = 0; i < points.size(); i++) {
            var point = points.get(i);
            if (point == null) {
                checks.fail(path + "[" + i + "]", "REQUIRED", "A point is required.");
                continue;
            }
            point(checks, path + "[" + i + "]", point);
        }
    }

    private static void point(ContentChecks checks, String path, Point point) {
        coordinate(checks, path + ".x", point.x());
        coordinate(checks, path + ".y", point.y());
    }

    private static void coordinate(ContentChecks checks, String path, Double value) {
        if (value == null) {
            checks.fail(path, "REQUIRED", "A value is required.");
        } else if (value.isNaN() || value < 0 || value > 100) {
            checks.fail(path, "OUT_OF_RANGE", "Use a value from 0 to 100.");
        }
    }
}
