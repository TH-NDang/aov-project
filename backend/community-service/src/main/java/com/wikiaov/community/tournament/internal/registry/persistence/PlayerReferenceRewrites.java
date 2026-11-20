package com.wikiaov.community.tournament.internal.registry.persistence;

import jakarta.persistence.EntityManager;
import java.util.UUID;
import org.springframework.stereotype.Repository;

/**
 * Fixed statements that move every editorial reference of one player to another when two profiles of one person are
 * merged (spec 04, merging players). An id is unique, so replacing its text inside a jsonb document can only touch
 * fields that name that player. Plan revisions and published snapshots are history and stay as they were.
 */
@Repository
public class PlayerReferenceRewrites {
    private static final String SHARED_GAMES = """
        SELECT COUNT(*) FROM tournament.game
         WHERE deleted_at IS NULL
           AND jsonb_path_exists(content,'$.sides[*].participants[*] ? (@.playerId == $id)',
                                 jsonb_build_object('id',CAST(:source AS text)))
           AND jsonb_path_exists(content,'$.sides[*].participants[*] ? (@.playerId == $id)',
                                 jsonb_build_object('id',CAST(:target AS text)))
        """;

    private static final String PUBLISHED = """
        SELECT (SELECT COUNT(*) FROM tournament.game_publication
                 WHERE jsonb_exists(snapshot->'players',CAST(:source AS text)))
             + (SELECT COUNT(*) FROM tournament.game
                 WHERE published_snapshot IS NOT NULL
                   AND jsonb_exists(published_snapshot->'players',CAST(:source AS text)))
        """;

    /** The target is already on that roster, so the source line would say the same thing twice. */
    private static final String TRASH_REPEATED_ROSTER_LINES = """
        UPDATE tournament.roster_membership line
           SET deleted_at=now(),deleted_by=:actor,updated_at=now(),edited_by=:actor,version=version+1
         WHERE line.player_id=:source AND line.deleted_at IS NULL
           AND EXISTS(SELECT 1 FROM tournament.roster_membership other
                       WHERE other.player_id=:target AND other.deleted_at IS NULL
                         AND other.tournament_id=line.tournament_id AND other.team_id=line.team_id)
        """;

    private static final String MOVE_ROSTER_LINES = """
        UPDATE tournament.roster_membership line
           SET player_id=:target,content=jsonb_set(content,'{playerId}',to_jsonb(CAST(:target AS text))),
               updated_at=now(),edited_by=:actor,version=version+1
         WHERE line.player_id=:source
           AND NOT EXISTS(SELECT 1 FROM tournament.roster_membership other
                           WHERE other.player_id=:target
                             AND other.tournament_id=line.tournament_id AND other.team_id=line.team_id)
        """;

    private static final String REWRITE_DOCUMENTS = """
        UPDATE tournament.%s
           SET content=CAST(replace(CAST(content AS text),CAST(:source AS text),CAST(:target AS text)) AS jsonb),
               updated_at=now(),edited_by=:actor,version=version+1
         WHERE strpos(CAST(content AS text),CAST(:source AS text))>0
        """;

    public record Moved(
            int rosterLines,
            int repeatedRosterLines,
            int tournaments,
            int series,
            int games
    ) {
    }

    private final EntityManager entities;

    public PlayerReferenceRewrites(EntityManager entities) {
        this.entities = entities;
    }

    /** Games in which both profiles took a seat: two people, not one. */
    public long sharedGames(UUID source, UUID target) {
        return ((Number) entities.createNativeQuery(SHARED_GAMES).setParameter("source", source)
                .setParameter("target", target).getSingleResult()).longValue();
    }

    /** Published games and their history that name the source; they never change. */
    public long publishedReferences(UUID source) {
        return ((Number) entities.createNativeQuery(PUBLISHED).setParameter("source", source).getSingleResult())
                .longValue();
    }

    public Moved move(UUID source, UUID target, String actor) {
        entities.flush();

        int repeated = update(TRASH_REPEATED_ROSTER_LINES, source, target, actor);
        int roster = update(MOVE_ROSTER_LINES, source, target, actor);
        int tournaments = update(REWRITE_DOCUMENTS.formatted("tournament"), source, target, actor);
        int series = update(REWRITE_DOCUMENTS.formatted("series"), source, target, actor);
        int games = update(REWRITE_DOCUMENTS.formatted("game"), source, target, actor);

        entities.clear();
        return new Moved(roster, repeated, tournaments, series, games);
    }

    private int update(String sql, UUID source, UUID target, String actor) {
        return entities.createNativeQuery(sql).setParameter("source", source).setParameter("target", target)
                .setParameter("actor", actor).executeUpdate();
    }
}
