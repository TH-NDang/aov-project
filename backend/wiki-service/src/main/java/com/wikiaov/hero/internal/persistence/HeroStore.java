package com.wikiaov.hero.internal.persistence;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.domain.HeroContent.Cause;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.platform.ApiException;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
@Repository
public class HeroStore {
    private final JdbcClient jdbc;
    public HeroStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }
    public List<Map<String, Object>> rows(String sql, Object... args) {
        return jdbc.sql(sql).params(args).query().listOfRows();
    }
    public int write(String sql, Object... args) {
        return jdbc.sql(sql).params(args).update();
    }
    public void lockHero(UUID heroId) {
        if (rows("SELECT id FROM hero.hero WHERE id=? FOR UPDATE", heroId).isEmpty())
            throw new ApiException(HeroErrorCode.HERO_NOT_FOUND, "The hero does not exist.");
    }
    public HeroRevisionView revision(UUID heroId, UUID id) {
        return jdbc.sql("SELECT * FROM hero.hero_revision WHERE hero_id=? AND id=?").params(heroId, id)
                .query((rs, n) -> map(rs)).optional()
                .orElseThrow(() -> new ApiException(HeroErrorCode.HERO_REVISION_NOT_FOUND,
                        "The hero revision does not exist."));
    }
    public List<HeroRevisionView> revisions(UUID heroId) {
        return jdbc.sql("SELECT * FROM hero.hero_revision WHERE hero_id=? ORDER BY revision_no DESC").param(heroId)
                .query((rs, n) -> map(rs)).list();
    }
    private HeroRevisionView map(ResultSet rs) throws SQLException {
        Map<HeroSection, UUID> sections = new EnumMap<>(HeroSection.class);
        for (var s : HeroSection.values()) {
            UUID value = rs.getObject(s.column(), UUID.class);
            if (value != null)
                sections.put(s, value);
        }
        var published = rs.getTimestamp("published_at");
        return new HeroRevisionView(rs.getObject("id", UUID.class), rs.getObject("hero_id", UUID.class),
                rs.getObject("ruleset_id", UUID.class), rs.getLong("revision_no"), rs.getString("state"),
                rs.getLong("version"), (Long) rs.getObject("publication_sequence"),
                published == null ? null : published.toInstant(), Cause.valueOf(rs.getString("cause")),
                rs.getObject("source_revision_id", UUID.class),
                rs.getObject("effective_from_patch_variant_id", UUID.class), sections);
    }
    public static Timestamp time(Instant instant) {
        return Timestamp.from(instant);
    }
}
