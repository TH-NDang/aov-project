package com.wikiaov.gamemode.internal.mapguide.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.gamemode.internal.domain.MapGuideContent;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.Callout;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.Lane;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.MapObject;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.Point;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.Section;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.TempoMoment;
import com.wikiaov.gamemode.internal.domain.MapGuideContent.Timing;
import com.wikiaov.platform.ApiFieldError;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class MapGuideContentRulesTest {
    @Test
    void acceptsAConsistentMap() {
        assertThat(MapGuideContentRules.validate(map())).isEmpty();
        assertThat(MapGuideContentRules.missingFields(map())).isEmpty();
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
        var outside = new MapObject("tru-ngoai", "Trụ ngoài", "STRUCTURE", "TOWER", null, List.of("Công trình"), null,
                new Timing(null, " "), new Timing(-1, null), List.of(), null,
                List.of(new Point(101.0, 50.0), new Point(null, 3.0)));
        var content = with(map(), List.of(outside));

        assertThat(errors(content)).containsExactlyInAnyOrder("objects[2].firstSpawn REQUIRED",
                "objects[2].respawn.seconds OUT_OF_RANGE", "objects[2].positions[0].x OUT_OF_RANGE",
                "objects[2].positions[1].x REQUIRED");
    }

    @Test
    void theTimelineIsAscendingAndCalloutsReferToKnownObjects() {
        var base = map();
        var tempo = List.of(new TempoMoment(120, null, List.of(), List.of("Caesar")),
                new TempoMoment(0, "Đầu trận", List.of(new Callout("Lạ", "khong-co", 10.0, 10.0)), List.of()),
                new TempoMoment(120, null, List.of(), List.of()));
        var content = new MapGuideContent(base.name(), null, null, null, base.objects(), base.lanes(), tempo, null);

        assertThat(errors(content)).containsExactlyInAnyOrder("tempo[1].seconds OUT_OF_ORDER",
                "tempo[1].callouts[0].objectCode UNKNOWN_REFERENCE", "tempo[2].seconds DUPLICATE_TIME");
    }

    @Test
    void rejectsUnknownCategoriesGlyphsAndLaneGlyphs() {
        var base = map();
        var odd = new MapObject("ho", "Hồ", "WATER", "LAKE", null, List.of(), null, null, null, List.of(), null,
                List.of(new Point(50.0, 50.0)));
        var lane = new Lane("duong-giua", "Đường giữa", "ROAD", null, List.of("Not A Code"), List.of(), List.of());
        var content = new MapGuideContent(base.name(), null, null, null, List.of(odd), List.of(lane), null, null);

        assertThat(errors(content)).containsExactlyInAnyOrder("objects[0].category INVALID_VALUE",
                "objects[0].glyph INVALID_VALUE", "lanes[0].glyph INVALID_VALUE", "lanes[0].heroCodes[0] INVALID_CODE");
    }

    @Test
    void publicationNeedsANameObjectsAndAPlaceForEveryFamilyHead() {
        var head = object("rong", null, List.of());
        var content = new MapGuideContent(" ", null, null, null, List.of(head), null, null, null);

        assertThat(MapGuideContentRules.missingFields(content)).containsExactly("name", "objects[0].positions");
        assertThat(MapGuideContentRules.missingFields(MapGuideContent.empty())).containsExactly("name", "objects");
    }

    private static MapGuideContent map() {
        var caesar = new MapObject("caesar", "Caesar", "EPIC", "CAESAR", null, List.of("Quái to", "Đẩy đường"),
                "Gọi Caesar tiên phong", new Timing(120, "Phút thứ 2"), new Timing(180, "3 phút"),
                List.of(new Section("Lợi ích hạ", "- Caesar tiên phong có năng lực đẩy đường rất mạnh.")),
                new Section("Khế ước Quang ám I", "Thêm hiệu ứng mới"), List.of(new Point(32.9, 28.1)));
        var darkCaesar = object("caesar-hac-am", "caesar", List.of());
        var lane = new Lane("duong-rong", "Đường Rồng", "LANE", "Đại đa số, xạ thủ sẽ đi đường này.",
                List.of("valhein"),
                List.of(new Point(60.0, 97.0)), List.of(new Point(12.0, 96.5), new Point(97.0, 97.0)));
        var tempo = List.of(
                new TempoMoment(0, "Đầu trận", List.of(new Callout("Bạn sẽ xuất hiện ở đây", null, 3.5, 96.5)),
                        List.of("Tế đàn: Nơi tướng xuất hiện và hồi sinh")),
                new TempoMoment(120, null, List.of(new Callout("Caesar xuất hiện", "caesar", 32.9, 28.1)),
                        List.of("Xuất hiện lần đầu: Phút thứ 2")));
        return new MapGuideContent("Bách khoa chiến trường", null, null, null, List.of(caesar, darkCaesar),
                List.of(lane), tempo, null);
    }

    private static MapGuideContent with(MapGuideContent base, List<MapObject> extra) {
        var objects = new ArrayList<>(base.objects());
        objects.addAll(extra);
        return new MapGuideContent(base.name(), base.observedOn(), base.summary(), base.backgroundAssetId(), objects,
                base.lanes(), base.tempo(), base.sources());
    }

    private static MapObject object(String code, String family, List<Point> positions) {
        return new MapObject(code, code, "EPIC", null, family, List.of(), null, null, null, List.of(), null,
                positions);
    }

    private static List<String> errors(MapGuideContent content) {
        return MapGuideContentRules.validate(content).stream().map(MapGuideContentRulesTest::describe).toList();
    }

    private static String describe(ApiFieldError error) {
        return error.path() + " " + error.code();
    }
}
