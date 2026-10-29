package com.wikiaov.community.tournament.internal.persistence;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GameRepository extends JpaRepository<GameRecord, UUID> {
    @org.springframework.data.jpa.repository.Query(value = "select * from tournament.game where published_at is not null and (cast(:tournamentId as text) is null or published_snapshot->'series'->>'tournamentId'=cast(:tournamentId as text)) and (cast(:seriesId as text) is null or published_snapshot->'content'->>'seriesId'=cast(:seriesId as text))", countQuery = "select count(*) from tournament.game where published_at is not null and (cast(:tournamentId as text) is null or published_snapshot->'series'->>'tournamentId'=cast(:tournamentId as text)) and (cast(:seriesId as text) is null or published_snapshot->'content'->>'seriesId'=cast(:seriesId as text))", nativeQuery = true)
    Page<GameRecord> findPublic(String tournamentId, String seriesId, Pageable page);

    Page<GameRecord> findBySeriesId(UUID seriesId, Pageable page);

    Page<GameRecord> findByPublishedAtIsNotNull(Pageable page);

    @org.springframework.data.jpa.repository.Query("""
        SELECT game FROM GameRecord game WHERE (:seriesId IS NULL OR game.seriesId=:seriesId)
          AND (:state='ALL' OR (:state='ACTIVE' AND game.deletedAt IS NULL) OR (:state='DELETED' AND game.deletedAt IS NOT NULL))
        """)
    Page<GameRecord> search(UUID seriesId, String state, Pageable page);
}
