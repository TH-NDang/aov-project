package com.wikiaov.community.tournament.internal.reference.persistence;

import com.wikiaov.community.tournament.internal.persistence.TeamRecord;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

public interface EditorReferenceRepository extends Repository<TeamRecord, UUID> {
    interface ReferenceRow {
        UUID getId();

        String getKind();

        String getName();

        String getCode();

        String getShortName();

        String getIcon();

        String getAliasesJson();
    }

    @Query(value = """
        SELECT id,'team' AS kind,name,code,content->>'shortName' AS "shortName",content->>'logoUrl' AS icon,
               CAST(content->'aliases' AS text) AS "aliasesJson"
          FROM tournament.team
         WHERE deleted_at IS NULL AND (:kind='' OR :kind='TEAM')
           AND reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
           AND (:filterIds=false OR id IN (:ids))
        UNION ALL
        SELECT id,'player' AS kind,name,code,NULL AS "shortName",content->>'photoUrl' AS icon,
               CAST(content->'aliases' AS text) AS "aliasesJson"
          FROM tournament.player
         WHERE deleted_at IS NULL AND (:kind='' OR :kind='PLAYER')
           AND reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
           AND (:filterIds=false OR id IN (:ids))
        ORDER BY name,kind,id
        """, countQuery = """
        SELECT (SELECT COUNT(*) FROM tournament.team
                 WHERE deleted_at IS NULL AND (:kind='' OR :kind='TEAM')
                   AND reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
                   AND (:filterIds=false OR id IN (:ids)))
             + (SELECT COUNT(*) FROM tournament.player
                 WHERE deleted_at IS NULL AND (:kind='' OR :kind='PLAYER')
                   AND reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
                   AND (:filterIds=false OR id IN (:ids)))
        """, nativeQuery = true)
    Page<ReferenceRow> search(String query, String kind, boolean filterIds, List<UUID> ids, Pageable page);

    /** What an editor is looking for while typing: the stronger name match first, then who was active last. */
    @Query(value = """
        SELECT id, kind, name, code, "shortName", icon, "aliasesJson"
          FROM (SELECT t.id,'team' AS kind,t.name,t.code,t.content->>'shortName' AS "shortName",t.content->>'logoUrl' AS icon,
                       CAST(t.content->'aliases' AS text) AS "aliasesJson", t.search_names, a.active_on
                  FROM tournament.team t
                  LEFT JOIN tournament.team_activity a ON a.team_id = t.id
                 WHERE t.deleted_at IS NULL AND (:kind='' OR :kind='TEAM')
                   AND t.reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
                UNION ALL
                SELECT p.id,'player' AS kind,p.name,p.code,NULL AS "shortName",p.content->>'photoUrl' AS icon,
                       CAST(p.content->'aliases' AS text) AS "aliasesJson", p.search_names, a.active_on
                  FROM tournament.player p
                  LEFT JOIN tournament.player_activity a ON a.player_id = p.id
                 WHERE p.deleted_at IS NULL AND (:kind='' OR :kind='PLAYER')
                   AND p.reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\') found
         ORDER BY tournament.name_match_rank(tournament.search_key(:wanted), search_names), active_on DESC NULLS LAST,
                  name, kind, id
        """, countQuery = """
        SELECT (SELECT COUNT(*) FROM tournament.team
                 WHERE deleted_at IS NULL AND (:kind='' OR :kind='TEAM')
                   AND reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\')
             + (SELECT COUNT(*) FROM tournament.player
                 WHERE deleted_at IS NULL AND (:kind='' OR :kind='PLAYER')
                   AND reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\')
        """, nativeQuery = true)
    Page<ReferenceRow> ranked(String query, String wanted, String kind, Pageable page);
}
