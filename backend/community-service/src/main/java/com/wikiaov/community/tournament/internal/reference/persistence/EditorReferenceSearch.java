package com.wikiaov.community.tournament.internal.reference.persistence;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Parameter;
import jakarta.persistence.Query;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.support.PageableExecutionUtils;
import org.springframework.stereotype.Repository;

/**
 * Teams and players an editor can name, read together from both registries. Native SQL because it matches with the
 * search functions of V002 and V013 and reads the jsonb documents. {@code teams} and {@code players} say which
 * registries a search reads.
 */
@Repository
public class EditorReferenceSearch {
    /**
     * A team or player as the editor sees it: {@code kind} is TEAM or PLAYER, {@code aliasesJson} the alias array as
     * stored.
     */
    public record ReferenceRow(
            UUID id,
            String kind,
            String name,
            String code,
            @Nullable String shortName,
            @Nullable String icon,
            @Nullable String aliasesJson
    ) {
    }

    private static final String BY_IDS = """
        SELECT id,'TEAM' AS kind,name,code,content->>'shortName' AS "shortName",content->>'logoUrl' AS icon,
               CAST(content->'aliases' AS text) AS "aliasesJson"
          FROM tournament.team
         WHERE deleted_at IS NULL AND :teams
           AND reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
           AND id IN (:ids)
        UNION ALL
        SELECT id,'PLAYER' AS kind,name,code,NULL AS "shortName",NULL AS icon,
               CAST(content->'aliases' AS text) AS "aliasesJson"
          FROM tournament.player
         WHERE deleted_at IS NULL AND :players
           AND reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
           AND id IN (:ids)
        ORDER BY name,kind,id
        """;

    private static final String BY_IDS_COUNT = """
        SELECT (SELECT COUNT(*) FROM tournament.team
                 WHERE deleted_at IS NULL AND :teams
                   AND reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
                   AND id IN (:ids))
             + (SELECT COUNT(*) FROM tournament.player
                 WHERE deleted_at IS NULL AND :players
                   AND reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
                   AND id IN (:ids))
        """;

    private static final String RANKED = """
        SELECT id, kind, name, code, "shortName", icon, "aliasesJson"
          FROM (SELECT t.id,'TEAM' AS kind,t.name,t.code,t.content->>'shortName' AS "shortName",t.content->>'logoUrl' AS icon,
                       CAST(t.content->'aliases' AS text) AS "aliasesJson", t.search_names, a.active_on
                  FROM tournament.team t
                  LEFT JOIN tournament.team_activity a ON a.team_id = t.id
                 WHERE t.deleted_at IS NULL AND :teams
                   AND t.reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
                UNION ALL
                SELECT p.id,'PLAYER' AS kind,p.name,p.code,NULL AS "shortName",NULL AS icon,
                       CAST(p.content->'aliases' AS text) AS "aliasesJson", p.search_names, a.active_on
                  FROM tournament.player p
                  LEFT JOIN tournament.player_activity a ON a.player_id = p.id
                 WHERE p.deleted_at IS NULL AND :players
                   AND p.reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\') found
         ORDER BY tournament.name_match_rank(tournament.search_key(:wanted), search_names), active_on DESC NULLS LAST,
                  name, kind, id
        """;

    private static final String RANKED_COUNT = """
        SELECT (SELECT COUNT(*) FROM tournament.team
                 WHERE deleted_at IS NULL AND :teams
                   AND reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\')
             + (SELECT COUNT(*) FROM tournament.player
                 WHERE deleted_at IS NULL AND :players
                   AND reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\')
        """;

    private final EntityManager entities;

    public EditorReferenceSearch(EntityManager entities) {
        this.entities = entities;
    }

    /** The records among {@code ids} that match the escaped search text. */
    public Page<ReferenceRow> byIds(String query, boolean teams, boolean players, List<UUID> ids, Pageable page) {
        var parameters = Map.<String, Object>of("query", query, "teams", teams, "players", players, "ids", ids);
        return page(BY_IDS, BY_IDS_COUNT, parameters, page);
    }

    /** What an editor is looking for while typing: the stronger name match first, then who was active last. */
    public Page<ReferenceRow> ranked(String query, String wanted, boolean teams, boolean players, Pageable page) {
        var parameters = Map.<String, Object>of("query", query, "wanted", wanted, "teams", teams, "players",
                players);
        return page(RANKED, RANKED_COUNT, parameters, page);
    }

    private Page<ReferenceRow> page(String sql, String countSql, Map<String, Object> parameters, Pageable page) {
        var query = bind(entities.createNativeQuery(sql), parameters);
        query.setFirstResult((int) page.getOffset());
        query.setMaxResults(page.getPageSize());
        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        var content = rows.stream().map(EditorReferenceSearch::row).toList();

        return PageableExecutionUtils.getPage(content, page, () -> ((Number) bind(
                entities.createNativeQuery(countSql), parameters).getSingleResult()).longValue());
    }

    /** Binds the parameters the query names; a count query names only part of those of its list. */
    private static Query bind(Query query, Map<String, Object> parameters) {
        for (Parameter<?> parameter : query.getParameters()) {
            if (!parameters.containsKey(parameter.getName())) {
                throw new IllegalStateException("No value for query parameter " + parameter.getName());
            }
            query.setParameter(parameter.getName(), parameters.get(parameter.getName()));
        }
        return query;
    }

    private static ReferenceRow row(Object[] row) {
        var id = row[0] instanceof UUID value ? value : UUID.fromString(row[0].toString());
        return new ReferenceRow(id, row[1].toString(), row[2].toString(), row[3].toString(),
                text(row[4]), text(row[5]), text(row[6]));
    }

    private static @Nullable String text(@Nullable Object value) {
        return value == null ? null : value.toString();
    }
}
