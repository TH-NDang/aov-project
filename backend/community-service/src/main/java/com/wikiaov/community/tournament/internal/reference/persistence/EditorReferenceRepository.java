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
}
