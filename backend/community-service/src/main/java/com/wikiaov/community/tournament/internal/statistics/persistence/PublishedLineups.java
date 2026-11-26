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
 * The published games, cut down to their bans, picks, builds and results. Native SQL because it takes parts of the
 * jsonb snapshots: {@code jsonb_to_record} unpacks each snapshot once, where one {@code ->} per part would unpack it
 * again every time.
 */
@Repository
public class PublishedLineups {
    /** A game belongs to a competition as the list of published games says: by the match frozen in its snapshot. */
    private static final String LINEUPS = """
        SELECT CAST(jsonb_build_object('id', g.id, 'publishedAt', g.published_at, 'seriesId', content."seriesId",
                      'number', content.number, 'winner', content.winner,
                      'durationSeconds', content."durationSeconds", 'mvpPlayerId', content."mvpPlayerId",
                      'turns', content.draft->'turns',
                      'players', (SELECT jsonb_object_agg(player.key, player.value->'nickname')
                                    FROM jsonb_each(part.players) AS player),
                      'sides', (SELECT jsonb_agg(jsonb_build_object('side', s.side, 'teamId', s."teamId",
                                         'bans', s.bans, 'seats', (
                                           SELECT jsonb_agg(jsonb_build_object('hero', p.hero, 'lane', p.lane,
                                                    'playerId', p."playerId", 'spell', p.spell,
                                                    'enchantments', p.enchantments->'entries', 'build', p.build,
                                                    'inventory', (
                                                      SELECT to_jsonb(e)
                                                        FROM jsonb_to_recordset(p."equipmentSnapshots")
                                                             AS e("atSeconds" integer, slots jsonb)
                                                       ORDER BY e."atSeconds" DESC NULLS LAST
                                                       LIMIT 1)))
                                             FROM jsonb_to_recordset(s.participants)
                                                  AS p(hero jsonb, lane text, "playerId" text, spell jsonb,
                                                       enchantments jsonb, build jsonb,
                                                       "equipmentSnapshots" jsonb))))
                                  FROM jsonb_to_recordset(content.sides)
                                       AS s(side text, "teamId" text, bans jsonb, participants jsonb)),
                      'catalog', (SELECT jsonb_object_agg(kind, known)
                                    FROM (SELECT kind, jsonb_agg(jsonb_build_object('id', k.id, 'code', k.code,
                                                   'name', k.name, 'iconUrl', k."iconUrl", 'tier', k.tier)) AS known
                                            FROM unnest(ARRAY['heroes', 'spells', 'enchantments', 'items']) AS kind
                                           CROSS JOIN LATERAL jsonb_to_recordset(part.catalog->kind)
                                                 AS k(id text, code text, name text, "iconUrl" text, tier integer)
                                           GROUP BY kind) AS kinds)) AS text)
          FROM tournament.game g
         CROSS JOIN LATERAL jsonb_to_record(g.published_snapshot) AS part(content jsonb, catalog jsonb, players jsonb)
         CROSS JOIN LATERAL jsonb_to_record(part.content) AS content("seriesId" text, number integer, winner text,
                      "durationSeconds" integer, "mvpPlayerId" text, draft jsonb, sides jsonb)
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
