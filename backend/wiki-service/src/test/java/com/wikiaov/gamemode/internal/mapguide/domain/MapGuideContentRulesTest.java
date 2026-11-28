package com.wikiaov.gamemode.internal.mapguide.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.gamemode.internal.domain.MapGuideContent;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.Area;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.Callout;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.Lane;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.MapObject;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.Point;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.Section;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.Spot;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.TempoMoment;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.Terrain;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.Timing;
import com.wikiaov.platform.ApiFieldError;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class MapGuideContentRulesTest {
    @Test
    void acceptsAConsistentMap() {
        assertThat(MapGuideContentRules.validate(map())).isEmpty();
        assertThat(MapGuideContentRules.missingFields(map())).isEmpty();
    }

    @Test
    void theSeededMapOfFiveVersusFiveIsConsistentAndComplete() throws IOException {
        var content = seededMap(SEED);

        assertThat(MapGuideContentRules.validate(content)).isEmpty();
        assertThat(MapGuideContentRules.missingFields(content)).isEmpty();
        assertThat(MapGuideContentRules.references(content)).contains("rong", "tru-ngoai.xanh-giua",
                "tru-ngoai.do-caesar", "khong-lo-thuat-si.do", "hang-rong", "rung-xanh-caesar", "duong-giua");
        assertThat(content.terrain()).extracting(Terrain::kind).contains("WALL", "RIVER", "JUNGLE");
    }

    @Test
    void theRealignedMapKeepsEveryReferenceAndPutsWhatStandsOnALaneOnItsLine() throws IOException {
        var seeded = seededMap(SEED);
        var realigned = seededMap(REALIGNED);

        assertThat(MapGuideContentRules.validate(realigned)).isEmpty();
        assertThat(MapGuideContentRules.missingFields(realigned)).isEmpty();
        assertThat(MapGuideContentRules.references(realigned))
                .containsExactlyInAnyOrderElementsOf(MapGuideContentRules.references(seeded));
        var onLanes = realigned.objects().stream()
                .filter(object -> LANE_PLACES.contains(object.code()))
                .flatMap(object -> object.positions().stream())
                .toList();
        assertThat(onLanes).hasSize(24).allSatisfy(spot -> assertThat(onALaneLine(spot)).as(spot.key()).isTrue());
    }

    @Test
    void terrainHasAKnownKindAndAnOutlineOnTheMap() {
        var base = map();
        var odd = new Terrain("LAVA", List.of(new Point(10.0, 10.0), new Point(12.0, 10.0), new Point(11.0, 12.0)));
        var off = new Terrain("WALL", List.of(new Point(10.0, 10.0), new Point(120.0, 10.0), new Point(11.0, 12.0)));
        var open = new Terrain(null, List.of(new Point(10.0, 10.0)));
        var content = new MapGuideContent(base.name(), null, null, null, base.objects(), null, base.lanes(), null,
                null, List.of(odd, off, open));

        assertThat(errors(content)).containsExactlyInAnyOrder("terrain[0].kind INVALID_VALUE",
                "terrain[1].outline[1].x OUT_OF_RANGE", "terrain[2].kind REQUIRED");
        assertThat(MapGuideContentRules.missingFields(content)).containsExactly("terrain[2].outline");
    }

    @Test
    void formsPointAtAFamilyHeadThatExists() {
        var nested = object("caesar-bao-chua", "caesar-hac-am", List.of());
        var unknown = object("rong-anh-sang", "rong", List.of());
        var self = object("bui-co", "bui-co", List.of());
        var content = with(map(), List.of(nested, unknown, self));

        assertThat(errors(content)).containsExactlyInAnyOrder("objects[2].family NESTED_FAMILY",
                "objects[3].family UNKNOWN_REFERENCE", "objects[4].family UNKNOWN_REFERENCE");
    }

    @Test
    void positionsStayOnTheMapAndTimingsNeedAValueOrAWording() {
        var outside = new MapObject("tru-ngoai", "Trụ ngoài", "STRUCTURE", "TOWER", null, null, null,
                List.of("Công trình"), null, new Timing(null, " "), new Timing(-1, null), List.of(), null,
                List.of(new Spot("xanh-rong", "BLUE", null, 101.0, 50.0), new Spot("do-rong", "RED", null, null, 3.0)));
        var content = with(map(), List.of(outside));

        assertThat(errors(content)).containsExactlyInAnyOrder("objects[2].firstSpawn REQUIRED",
                "objects[2].respawn.seconds OUT_OF_RANGE", "objects[2].positions[0].x OUT_OF_RANGE",
                "objects[2].positions[1].x REQUIRED");
    }

    @Test
    void everyPlaceOfAnObjectInSeveralPlacesHasItsOwnKeyAndAKnownSide() {
        var tower = new MapObject("tru-giua", "Trụ giữa", "STRUCTURE", "TOWER", null, null, null, List.of(), null,
                null, null, List.of(), null,
                List.of(new Spot(null, "BLUE", null, 3.0, 56.7), new Spot("do-giua", "PURPLE", null, 68.2, 29.5),
                        new Spot("do-giua", "RED", null, 97.0, 43.3)));
        var content = with(map(), List.of(tower));

        assertThat(errors(content)).containsExactlyInAnyOrder("objects[2].positions[0].key REQUIRED",
                "objects[2].positions[1].side INVALID_VALUE", "objects[2].positions[2].key DUPLICATE_CODE");
    }

    @Test
    void areasLanesAndObjectsShareOneSetOfCodes() {
        var base = map();
        var pit = new Area("caesar", "Hang Caesar", null, null, List.of(new Point(30.0, 25.0)));
        var lane = new Lane("hang-rong", "Đường Rồng", "LANE", null, List.of(), List.of(), List.of());
        var content = new MapGuideContent(base.name(), null, null, null, base.objects(),
                List.of(pit, area("hang-rong")), List.of(lane), null, null, null);

        assertThat(errors(content)).containsExactlyInAnyOrder("areas[0].code DUPLICATE_CODE",
                "lanes[0].code DUPLICATE_CODE");
        assertThat(MapGuideContentRules.missingFields(content)).containsExactly("areas[0].outline");
    }

    @Test
    void theTimelineIsAscendingAndCalloutsReferToKnownPlaces() {
        var base = map();
        var tempo = List.of(new TempoMoment(120, null, List.of(), List.of("Caesar")),
                new TempoMoment(0, "Đầu trận", List.of(new Callout("Lạ", "khong-co", null, 10.0, 10.0),
                        new Callout("Hang", "caesar", "do", 32.9, 28.1)), List.of()),
                new TempoMoment(120, null, List.of(), List.of()));
        var content = new MapGuideContent(base.name(), null, null, null, base.objects(), null, base.lanes(), tempo,
                null, null);

        assertThat(errors(content)).containsExactlyInAnyOrder("tempo[1].seconds OUT_OF_ORDER",
                "tempo[1].callouts[0].objectCode UNKNOWN_REFERENCE", "tempo[1].callouts[1].spotKey UNKNOWN_REFERENCE",
                "tempo[2].seconds DUPLICATE_TIME");
    }

    @Test
    void rejectsUnknownCategoriesGlyphsAndLaneGlyphs() {
        var base = map();
        var odd = new MapObject("ho", "Hồ", "WATER", "LAKE", null, null, null, List.of(), null, null, null,
                List.of(), null, List.of(new Spot(null, null, null, 50.0, 50.0)));
        var lane = new Lane("duong-giua", "Đường giữa", "ROAD", null, List.of("Not A Code"), List.of(), List.of());
        var content = new MapGuideContent(base.name(), null, null, null, List.of(odd), null, List.of(lane), null,
                null, null);

        assertThat(errors(content)).containsExactlyInAnyOrder("objects[0].category INVALID_VALUE",
                "objects[0].glyph INVALID_VALUE", "lanes[0].glyph INVALID_VALUE", "lanes[0].heroCodes[0] INVALID_CODE");
    }

    @Test
    void publicationNeedsANameObjectsAndAPlaceForEveryFamilyHead() {
        var head = object("rong", null, List.of());
        var content = new MapGuideContent(" ", null, null, null, List.of(head), null, null, null, null, null);

        assertThat(MapGuideContentRules.missingFields(content)).containsExactly("name", "objects[0].positions");
        assertThat(MapGuideContentRules.missingFields(MapGuideContent.empty())).containsExactly("name", "objects");
    }

    @Test
    void listsTheBackgroundTheIconsAndThePicturesAsAssets() {
        var background = UUID.randomUUID();
        var icon = UUID.randomUUID();
        var picture = UUID.randomUUID();
        var base = map();
        var caesar = base.objects().getFirst();
        var drawn = new MapObject(caesar.code(), caesar.name(), caesar.category(), caesar.glyph(), icon, picture,
                null, caesar.tags(), caesar.summary(), caesar.firstSpawn(), caesar.respawn(), caesar.sections(),
                caesar.change(), caesar.positions());
        var content = new MapGuideContent(base.name(), null, null, background, List.of(drawn), null, null, null,
                null, null);

        assertThat(MapGuideContentRules.assets(content)).containsExactly(background, icon, picture);
        assertThat(MapGuideContentRules.icons(content)).containsExactly(icon);
    }

    private static MapGuideContent map() {
        var caesar = new MapObject("caesar", "Caesar", "EPIC", "CAESAR", null, null, null,
                List.of("Quái to", "Đẩy đường"), "Gọi Caesar tiên phong", new Timing(120, "Phút thứ 2"),
                new Timing(180, "3 phút"),
                List.of(new Section("Lợi ích hạ", "- Caesar tiên phong có năng lực đẩy đường rất mạnh.")),
                new Section("Khế ước Quang ám I", "Thêm hiệu ứng mới"),
                List.of(new Spot(null, null, null, 32.9, 28.1)));
        var darkCaesar = object("caesar-hac-am", "caesar", List.of());
        var lane = new Lane("duong-rong", "Đường Rồng", "LANE", "Đại đa số, xạ thủ sẽ đi đường này.",
                List.of("valhein"),
                List.of(new Point(60.0, 97.0)), List.of(new Point(12.0, 96.5), new Point(97.0, 97.0)));
        var tempo = List.of(
                new TempoMoment(0, "Đầu trận",
                        List.of(new Callout("Bạn sẽ xuất hiện ở đây", null, null, 3.5, 96.5)),
                        List.of("Tế đàn: Nơi tướng xuất hiện và hồi sinh")),
                new TempoMoment(120, null, List.of(new Callout("Caesar xuất hiện", "caesar", null, 32.9, 28.1)),
                        List.of("Xuất hiện lần đầu: Phút thứ 2")));
        var wall = new Terrain("WALL", List.of(new Point(20.0, 20.0), new Point(24.0, 20.0), new Point(22.0, 26.0)));
        return new MapGuideContent("Bách khoa chiến trường", null, null, null, List.of(caesar, darkCaesar),
                List.of(area("hang-caesar")), List.of(lane), tempo, null, List.of(wall));
    }

    private static Area area(String code) {
        return new Area(code, code, null, null,
                List.of(new Point(30.0, 25.0), new Point(36.0, 25.0), new Point(33.0, 31.0)));
    }

    private static final String SEED = "V081__seed_5v5_map_guide.sql";
    private static final String REALIGNED = "V082__realign_5v5_map_guide.sql";
    private static final List<String> LANE_PLACES = List.of("tru-trong", "tru-giua", "tru-ngoai", "goi-mau");

    /** Side lanes run 3.5 in from the edge; the middle lane runs on the diagonal x + y = 100. */
    private static boolean onALaneLine(Spot spot) {
        return spot.x() == 3.5 || spot.x() == 96.5 || spot.y() == 3.5 || spot.y() == 96.5
                || Math.abs(spot.x() + spot.y() - 100) < 1e-9;
    }

    private static MapGuideContent seededMap(String migration) throws IOException {
        try (var stream = MapGuideContentRulesTest.class.getResourceAsStream("/db/migration/" + migration)) {
            assertThat(stream).isNotNull();
            String sql = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
            String json = sql.substring(sql.indexOf("$json$") + 6, sql.lastIndexOf("$json$"));
            return JsonMapper.builder().build().readValue(json, MapGuideContent.class);
        }
    }

    private static MapGuideContent with(MapGuideContent base, List<MapObject> extra) {
        var objects = new ArrayList<>(base.objects());
        objects.addAll(extra);
        return new MapGuideContent(base.name(), base.observedOn(), base.summary(), base.backgroundAssetId(), objects,
                base.areas(), base.lanes(), base.tempo(), base.sources(), base.terrain());
    }

    private static MapObject object(String code, String family, List<Spot> positions) {
        return new MapObject(code, code, "EPIC", null, null, null, family, List.of(), null, null, null, List.of(),
                null, positions);
    }

    private static List<String> errors(MapGuideContent content) {
        return MapGuideContentRules.validate(content).stream().map(MapGuideContentRulesTest::describe).toList();
    }

    private static String describe(ApiFieldError error) {
        return error.path() + " " + error.code();
    }
}
