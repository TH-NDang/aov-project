package com.wikiaov.community.tournament.internal.review.persistence;

import com.wikiaov.community.tournament.internal.review.domain.Mention;
import com.wikiaov.community.tournament.internal.review.domain.Mention.Count;
import com.wikiaov.community.tournament.internal.review.domain.MentionKind;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Repository;

/**
 * Text that names an MVP, a caster, an award recipient or an award's team where no link does, in records and
 * tournaments outside the trash. Native: reads the notes and award lines of the jsonb documents with PostgreSQL
 * regular expressions (ADR-015 allows native reads over the documents).
 */
@Repository
public class UnlinkedMentions {
    private static final String MENTIONS = """
        WITH match AS (
            SELECT s.id, s.content, s.tournament_id, ta.name || ' vs ' || tb.name AS label
              FROM tournament.series s
              JOIN tournament.tournament t ON t.id = s.tournament_id AND t.deleted_at IS NULL
              LEFT JOIN tournament.team ta ON CAST(ta.id AS text) = s.content->>'teamAId'
              LEFT JOIN tournament.team tb ON CAST(tb.id AS text) = s.content->>'teamBId'
             WHERE s.deleted_at IS NULL
        ), mention AS (
            SELECT 'GAME_MVP' AS kind, g.id AS record_id, m.tournament_id, m.id AS series_id,
                   g.game_number, m.label, btrim(substring(g.content->>'note' from 'MVP: ([^\\n]*)')) AS text
              FROM tournament.game g JOIN match m ON m.id = g.series_id
             WHERE g.deleted_at IS NULL AND g.content->>'mvpPlayerId' IS NULL AND g.content->>'note' ~ 'MVP: '
            UNION ALL
            SELECT 'SERIES_MVP', m.id, m.tournament_id, m.id, NULL, m.label,
                   btrim(substring(m.content->>'note' from '(?:^|\\n)MVP(?: trận)?: ([^\\n(]*)'))
              FROM match m
             WHERE m.content->>'mvpPlayerId' IS NULL AND m.content->>'note' ~ '(^|\\n)MVP( trận)?: '
            UNION ALL
            SELECT 'SERIES_BROADCAST', m.id, m.tournament_id, m.id, NULL, m.label,
                   btrim(substring(m.content->>'note' from '(?:^|\\n)Bình luận: ([^\\n]*)'))
              FROM match m
             WHERE coalesce(jsonb_array_length(m.content->'broadcast'), 0) = 0
               AND m.content->>'note' ~ '(^|\\n)Bình luận: '
            UNION ALL
            SELECT 'AWARD_PLAYER', t.id, t.id, NULL, NULL, award->>'title', award->>'recipientName'
              FROM tournament.tournament t, jsonb_array_elements(coalesce(t.content->'awards', '[]')) award
             WHERE t.deleted_at IS NULL AND award->>'playerId' IS NULL
               AND coalesce(btrim(award->>'recipientName'), '') <> ''
            UNION ALL
            SELECT 'AWARD_TEAM', t.id, t.id, NULL, NULL, award->>'title', award->>'teamName'
              FROM tournament.tournament t, jsonb_array_elements(coalesce(t.content->'awards', '[]')) award
             WHERE t.deleted_at IS NULL AND award->>'teamId' IS NULL
               AND coalesce(btrim(award->>'teamName'), '') <> ''
        )
        """;

    private static final String PAGE = MENTIONS + """
        SELECT mention.kind, mention.record_id, mention.tournament_id, t.name AS tournament_name, mention.series_id,
               mention.game_number, mention.label, mention.text
          FROM mention JOIN tournament.tournament t ON t.id = mention.tournament_id
         WHERE mention.kind = :kind
         ORDER BY t.starts_on DESC NULLS LAST, t.name, mention.record_id, mention.label, mention.text
         LIMIT :size OFFSET :offset
        """;

    private static final String TOTAL = MENTIONS + "SELECT COUNT(*) FROM mention WHERE kind = :kind";

    private static final String COUNTS = MENTIONS + "SELECT kind, COUNT(*) AS count FROM mention GROUP BY kind";

    private final EntityManager entities;

    public UnlinkedMentions(EntityManager entities) {
        this.entities = entities;
    }

    /** The columns come in the order {@code PAGE} selects them. */
    @SuppressWarnings("unchecked")
    public List<Mention> page(MentionKind kind, int page, int size) {
        List<Object[]> rows = entities.createNativeQuery(PAGE).setParameter("kind", kind.name())
                .setParameter("size", size).setParameter("offset", (long) page * size).getResultList();
        return rows.stream().map(row -> new Mention(MentionKind.valueOf(row[0].toString()), uuid(row[1]), uuid(row[2]),
                text(row[3]), uuid(row[4]), row[5] == null ? null : ((Number) row[5]).intValue(), text(row[6]),
                text(row[7]))).toList();
    }

    public long total(MentionKind kind) {
        return ((Number) entities.createNativeQuery(TOTAL).setParameter("kind", kind.name()).getSingleResult())
                .longValue();
    }

    @SuppressWarnings("unchecked")
    public List<Count> counts() {
        List<Object[]> rows = entities.createNativeQuery(COUNTS).getResultList();
        return rows.stream()
                .map(row -> new Count(MentionKind.valueOf(row[0].toString()), ((Number) row[1]).longValue())).toList();
    }

    private static @Nullable UUID uuid(@Nullable Object value) {
        return value == null || value instanceof UUID ? (UUID) value : UUID.fromString(value.toString());
    }

    private static @Nullable String text(@Nullable Object value) {
        return value == null ? null : value.toString();
    }
}
