package com.wikiaov.patch.internal.persistence;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
@Repository
public class PatchStore {
    private final JdbcClient jdbc;
    public PatchStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }
    public List<Map<String, Object>> rows(String sql, Object... args) {
        return jdbc.sql(sql).params(args).query().listOfRows();
    }
    public Map<String, Object> one(String sql, Object... args) {
        return rows(sql, args).stream().findFirst()
                .orElseThrow(() -> new com.wikiaov.platform.ApiException(
                        com.wikiaov.patch.internal.application.PatchErrorCode.PATCH_NOT_FOUND,
                        "Patch resource does not exist."));
    }
    public int write(String sql, Object... args) {
        return jdbc.sql(sql).params(args).update();
    }
    public void lockRuleset(UUID id) {
        one("SELECT id FROM patch.gameplay_ruleset WHERE id=? FOR UPDATE", id);
    }
}
