package com.wikiaov.gamemode.internal.domain;

import com.wikiaov.gamemode.internal.domain.GameModeContent.Source;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * One consistent snapshot of the in-game battlefield encyclopedia of a mode: the objects on the map, named areas, the
 * lanes and the match tempo. Positions are top-down percentages of the square map: {@code x} grows to the right,
 * {@code y} grows downwards, the blue side's base is at the bottom left and the red side's at the top right.
 *
 * <p>Other content refers to a place by a stable reference: an object, lane or area {@code code}, or
 * {@code code.key} for one position of an object (see {@code MapGuideContentRules.references}). Codes and keys are
 * never renamed once published.
 *
 * <p>Body texts follow the rule section convention: lines starting with "- " are bullet points.
 *
 * @param backgroundAssetId optional map art shown under the markers instead of the drawn map
 * @param terrain           shapes of the drawn ground under the markers, such as walls and the river; not shown over
 *                          map art
 */
public record MapGuideContent(
        String name,
        LocalDate observedOn,
        String summary,
        UUID backgroundAssetId,
        List<MapObject> objects,
        List<Area> areas,
        List<Lane> lanes,
        List<TempoMoment> tempo,
        List<Source> sources,
        List<Terrain> terrain
) {

    public MapGuideContent {
        objects = copy(objects);
        areas = copy(areas);
        lanes = copy(lanes);
        tempo = copy(tempo);
        sources = copy(sources);
        terrain = copy(terrain);
    }

    public static MapGuideContent empty() {
        return new MapGuideContent(null, null, null, null, null, null, null, null, null, null);
    }

    private static <T> List<T> copy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    /**
     * A building, minion, monster or mechanic of the map, with the game's tags and texts.
     *
     * @param category  {@code STRUCTURE}, {@code MINION}, {@code MONSTER}, {@code EPIC} or {@code MECHANIC}
     * @param glyph     the drawn symbol of the object, see the content rules
     * @param iconAssetId    optional uploaded icon shown instead of the drawn symbol
     * @param pictureAssetId optional picture of the place, shown in the object's details
     * @param family    code of the object this one is a form of (the dark Caesar of Caesar); forms have no marker of
     *                  their own and are shown with their family head
     * @param tags      the game's labels, such as the big monster or vision tags
     * @param change    the game's latest change note, shown under its changes switch
     * @param positions where the object stands; empty for forms and for objects without a fixed place
     */
    public record MapObject(
            String code,
            String name,
            String category,
            String glyph,
            UUID iconAssetId,
            UUID pictureAssetId,
            String family,
            List<String> tags,
            String summary,
            Timing firstSpawn,
            Timing respawn,
            List<Section> sections,
            Section change,
            List<Spot> positions
    ) {

        public MapObject {
            tags = copy(tags);
            sections = copy(sections);
            positions = copy(positions);
        }
    }

    /**
     * A spawn time as the game words it. {@code seconds} is set when the time is fixed; {@code note} holds the game's
     * wording or the condition when it is not.
     */
    public record Timing(
            Integer seconds,
            String note
    ) {
    }

    public record Section(
            String title,
            String body
    ) {
    }

    public record Point(
            Double x,
            Double y
    ) {
    }

    /**
     * One place where an object stands.
     *
     * @param key   stable name of the place within its object, such as {@code xanh-giua}; required when the object
     *              stands in more than one place
     * @param side  {@code BLUE} or {@code RED} for a place that belongs to one side, null for a neutral one
     * @param label optional short name of the place, such as the lane it guards
     */
    public record Spot(
            String key,
            String side,
            String label,
            Double x,
            Double y
    ) {
    }

    /**
     * A named region of the map, such as a pit, the river or one side's jungle, for references from other content.
     *
     * @param side    {@code BLUE}, {@code RED} or null for a neutral area
     * @param outline the polygon of the area, at least three points
     */
    public record Area(
            String code,
            String name,
            String side,
            String summary,
            List<Point> outline
    ) {

        public Area {
            outline = copy(outline);
        }
    }

    /**
     * A lane or role of the lanes tab.
     *
     * @param glyph     {@code LANE}, {@code JUNGLE}, {@code MID} or {@code SUPPORT}
     * @param heroCodes heroes the editors suggest for the role, linking to the hero catalog
     * @param positions where the role marker stands on the reader's side
     * @param path      the lane's route on the reader's side, empty for roaming roles
     */
    public record Lane(
            String code,
            String name,
            String glyph,
            String body,
            List<String> heroCodes,
            List<Point> positions,
            List<Point> path
    ) {

        public Lane {
            heroCodes = copy(heroCodes);
            positions = copy(positions);
            path = copy(path);
        }
    }

    /**
     * A mark on the match timeline of the tempo tab.
     *
     * @param phase    the timeline label that starts at this mark, such as mid game; null when the mark opens none
     * @param callouts labelled points on the map at this time
     * @param steps    the game's numbered texts for this time, in order
     */
    public record TempoMoment(
            Integer seconds,
            String phase,
            List<Callout> callouts,
            List<String> steps
    ) {

        public TempoMoment {
            callouts = copy(callouts);
            steps = copy(steps);
        }
    }

    /**
     * A labelled point; {@code objectCode} opens that object's details when set, and {@code spotKey} names which of
     * its places the label marks.
     */
    public record Callout(
            String label,
            String objectCode,
            String spotKey,
            Double x,
            Double y
    ) {
    }

    /**
     * A shape of the drawn ground. Terrain only draws the map: other content refers to areas, never to terrain.
     *
     * @param kind    {@code WALL}, {@code RIVER}, {@code JUNGLE} (the jungle floor) or {@code BUSH}
     * @param outline the polygon of the shape, at least three points; the Wiki rounds its corners
     */
    public record Terrain(
            String kind,
            List<Point> outline
    ) {

        public Terrain {
            outline = copy(outline);
        }
    }
}
