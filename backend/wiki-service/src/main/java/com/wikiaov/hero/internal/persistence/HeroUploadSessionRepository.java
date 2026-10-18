package com.wikiaov.hero.internal.persistence;

import com.wikiaov.hero.internal.persistence.entity.HeroUploadSession;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface HeroUploadSessionRepository extends JpaRepository<HeroUploadSession, UUID> {
    List<HeroUploadSession> findByOwnerIssuerAndOwnerSubjectOrderByUpdatedAtDesc(String issuer, String subject);
    @Query(value = "SELECT * FROM hero.upload_session WHERE id=:id FOR UPDATE", nativeQuery = true)
    Optional<HeroUploadSession> lock(UUID id);
    @Modifying
    @Query(value = """
            INSERT INTO hero.upload_session(id,owner_issuer,owner_subject,state_json,version,updated_at)
            VALUES (:id,:issuer,:subject,:state,0,CURRENT_TIMESTAMP) ON CONFLICT (id) DO NOTHING
            """, nativeQuery = true)
    int create(UUID id, String issuer, String subject, String state);
    List<HeroUploadSession> findByStateJsonContaining(String value);
}
