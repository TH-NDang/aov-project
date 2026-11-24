package com.wikiaov.community.tournament.internal.reference.persistence;

import com.wikiaov.community.tournament.internal.reference.domain.PublishedCompetition;
import jakarta.persistence.EntityManager;
import java.util.List;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.json.JsonMapper;

/**
 * The published competitions, cut down to what a text can name. Native SQL because it takes parts of the jsonb
 * snapshots: {@code jsonb_to_record} unpacks each snapshot once, where one {@code ->} per part would unpack it again
 * every time.
 */
@Repository
public class PublishedCompetitions {
    private static final String NAMED = """
        SELECT CAST(jsonb_build_object('id', p.id, 'tournament', part.tournament, 'circuit', part.circuit,
                      'teams', part.teams, 'players', part.players, 'people', part.people, 'rosters', part.rosters,
                      'crews', jsonb_path_query_array(coalesce(part.series, '{}'), '$.*.broadcast[*]')) AS text)
          FROM tournament.competition_plan p
         CROSS JOIN LATERAL jsonb_to_record(p.published_snapshot) AS part(tournament jsonb, circuit jsonb, teams jsonb,
                      players jsonb, people jsonb, rosters jsonb, series jsonb)
         WHERE p.published_at IS NOT NULL
        """;

    /** Every publication and withdrawal changes it, because each publication has a time of its own. */
    private static final String REVISION = """
        SELECT coalesce(md5(string_agg(concat(id, published_at), ',' ORDER BY id)), '')
          FROM tournament.competition_plan
         WHERE published_at IS NOT NULL
        """;

    private final EntityManager entities;
    private final JsonMapper json;

    public PublishedCompetitions(EntityManager entities, JsonMapper json) {
        this.entities = entities;
        this.json = json;
    }

    public List<PublishedCompetition> named() {
        @SuppressWarnings("unchecked")
        List<Object> rows = entities.createNativeQuery(NAMED).getResultList();

        return rows.stream().map(row -> json.readValue(row.toString(), PublishedCompetition.class)).toList();
    }

    public String revision() {
        return entities.createNativeQuery(REVISION).getSingleResult().toString();
    }
}
