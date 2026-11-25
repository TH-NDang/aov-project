package com.wikiaov.community.tournament.internal.statistics.persistence;

import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectReader;
import tools.jackson.databind.json.JsonMapper;

/**
 * The published games, cut down to their bans, picks and results. Native SQL because it takes parts of the jsonb
 * snapshots: {@code jsonb_to_record} unpacks each snapshot once, where one {@code ->} per part would unpack it again
 * every time.
 */
@Repository
public class PublishedLineups {
    /** A game belongs to a competition as the list of published games says: by the match frozen in its snapshot. */
    private static final String LINEUPS = """
        SELECT CAST(jsonb_build_object('id', g.id, 'publishedAt', g.published_at, 'winner', content.winner,
                      'durationSeconds', content."durationSeconds", 'mvpPlayerId', content."mvpPlayerId",
                      'sides', (SELECT jsonb_agg(jsonb_build_object('side', s.side, 'bans', s.bans,
                                         'picks', jsonb_path_query_array(s.participants, '$[*].hero')))
                                  FROM jsonb_to_recordset(content.sides)
                                       AS s(side text, bans jsonb, participants jsonb)),
                      'heroes', (SELECT jsonb_agg(jsonb_build_object('id', h.id, 'code', h.code, 'name', h.name,
                                         'iconUrl', h."iconUrl"))
                                   FROM jsonb_to_recordset(part.catalog->'heroes')
                                        AS h(id text, code text, name text, "iconUrl" text))) AS text)
          FROM tournament.game g
         CROSS JOIN LATERAL jsonb_to_record(g.published_snapshot) AS part(content jsonb, catalog jsonb)
         CROSS JOIN LATERAL jsonb_to_record(part.content) AS content(winner text, "durationSeconds" integer,
                      "mvpPlayerId" text, sides jsonb)
         WHERE g.published_at IS NOT NULL
           AND g.published_snapshot->'series'->>'tournamentId' = CAST(:tournamentId AS text)
         ORDER BY g.published_at DESC, g.id
        """;

    /**
     * Opens no snapshot. A publication sets a newer time, a withdrawal takes a game away, and the two happen one after
     * another under the write lock, so no sequence of them leads back to an earlier answer.
     */
    private static final String PUBLICATIONS = """
        SELECT concat(count(*), '@', max(published_at)) FROM tournament.game WHERE published_at IS NOT NULL
        """;

    private final EntityManager entities;
    /** Published snapshots keep the fields they were written with, also after a field is dropped from the record. */
    private final ObjectReader lineups;

    public PublishedLineups(EntityManager entities, JsonMapper json) {
        this.entities = entities;
        this.lineups = json.readerFor(PublishedLineup.class).without(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
    }

    /** The published games of a competition, the one published last first. */
    public List<PublishedLineup> of(UUID competitionId) {
        @SuppressWarnings("unchecked")
        List<Object> rows = entities.createNativeQuery(LINEUPS).setParameter("tournamentId", competitionId.toString())
                .getResultList();

        return rows.stream().map(row -> lineups.<PublishedLineup>readValue(row.toString())).toList();
    }

    /** Changes with every publication and withdrawal of a game, in any competition. */
    public String publications() {
        return entities.createNativeQuery(PUBLICATIONS).getSingleResult().toString();
    }
}
