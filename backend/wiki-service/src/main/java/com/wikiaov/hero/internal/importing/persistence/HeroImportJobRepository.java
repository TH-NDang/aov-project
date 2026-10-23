package com.wikiaov.hero.internal.importing.persistence;

import com.wikiaov.hero.internal.importing.persistence.entity.HeroImportJob;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface HeroImportJobRepository extends JpaRepository<HeroImportJob, UUID> {
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE hero.import_job SET notification_dismissed=true
            WHERE id=:id AND owner_issuer=:issuer AND owner_subject=:subject AND completed=total
            """, nativeQuery = true)
    int dismissNotification(UUID id, String issuer, String subject);

    @Query(value = """
            SELECT * FROM hero.import_job WHERE owner_issuer=:issuer AND owner_subject=:subject
            AND (completed < total OR id IN (SELECT id FROM hero.import_job
              WHERE owner_issuer=:issuer AND owner_subject=:subject AND completed=total
              ORDER BY created_at DESC LIMIT 20)) ORDER BY created_at DESC
            """, nativeQuery = true)
    List<HeroImportJob> visible(String issuer, String subject);

    @Query(value = "SELECT * FROM hero.import_job WHERE completed < total AND request_json LIKE :pattern", nativeQuery = true)
    List<HeroImportJob> referencing(String pattern);

    @Query(value = "SELECT * FROM hero.import_job WHERE completed < total ORDER BY updated_at LIMIT 20", nativeQuery = true)
    List<HeroImportJob> pending();

    @Query(value = "SELECT * FROM hero.import_job WHERE id = :id FOR UPDATE SKIP LOCKED", nativeQuery = true)
    Optional<HeroImportJob> lock(UUID id);

    @Modifying
    @Query(value = """
            INSERT INTO hero.import_job(id,owner_issuer,owner_subject,owner_type,request_json,total,created_at,updated_at)
            VALUES (:id,:issuer,:subject,:type,:payload,:total,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO NOTHING
            """, nativeQuery = true)
    int enqueue(UUID id, String issuer, String subject, String type, String payload, int total);
}
