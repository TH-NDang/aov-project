package com.wikiaov.gamemode.internal.domain;

import com.wikiaov.gamemode.internal.domain.AutoChessContent.Item;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.ItemGroup;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.Lineup;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.LineupUnit;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.Skill;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.Trait;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.TraitTier;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.Unit;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.UnitStats;
import java.util.List;
import java.util.UUID;

/** A small guide in the shape of the 08/11/2026 encyclopedia, for rule tests. */
public final class AutoChessFixtures {
    public static final UUID LINEUP_ID = UUID.fromString("7f6c1d2e-0000-4000-8000-000000000001");

    private AutoChessFixtures() {
    }

    public static AutoChessContent guide() {
        var traits = List.of(
                new Trait("dau-si", "FACTION", "Đấu sĩ", null, null,
                        List.of(new TraitTier(2, "+1000 lá chắn"), new TraitTier(4, "+2000 lá chắn")), null),
                new Trait("giai-dieu-hoc-duong", "CLASS", "Giai Điệu Học Đường", null, null,
                        List.of(new TraitTier(3, "20% tỷ lệ"), new TraitTier(6, "50% tỷ lệ")), null),
                new Trait("phao-thu", "FACTION", "Pháo thủ", null, null, List.of(new TraitTier(2, "+30% chí mạng")),
                        null));
        var units = List.of(unit("violet", "Violet", 1, "phao-thu", "giai-dieu-hoc-duong"),
                unit("arduin", "Arduin", 1, "dau-si"), unit("florentino", "Florentino", 2, "dau-si",
                        "giai-dieu-hoc-duong"),
                unit("amily", "Amily", 1, "giai-dieu-hoc-duong"));
        var items = List.of(new Item("thanh-kiem", "Thánh kiếm", "Tăng 70% ST chí mạng", "da-do", 0, null));
        var lineups = List.of(new Lineup(LINEUP_ID, "hoc-duong", "Học đường", "A", "EASY", null,
                List.of(new LineupUnit("violet", true, "BACK", List.of("thanh-kiem")),
                        new LineupUnit("florentino", false, "FRONT", List.of()),
                        new LineupUnit("amily", false, "FRONT", List.of())),
                List.of(), List.of(), null));
        return new AutoChessContent("Bách khoa thử", null, null, List.of(), traits, units,
                List.of(new ItemGroup("da-do", "Nhóm đá đỏ", 7)), items, List.of(), List.of(), lineups, List.of());
    }

    public static Unit unit(String code, String name, int cost, String... traits) {
        return new Unit(code, name, cost, List.of(traits), UUID.randomUUID(), null,
                new Skill("Chiêu", "Mô tả", null, "ST phép", List.of("1", "2", "3")),
                new UnitStats(List.of(1, 2, 3), List.of(1, 2, 3), List.of(1, 2, 3), List.of(1, 2, 3)), true, null);
    }
}
