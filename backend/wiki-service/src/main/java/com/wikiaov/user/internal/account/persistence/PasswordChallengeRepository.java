package com.wikiaov.user.internal.account.persistence;

import com.wikiaov.user.internal.account.persistence.entity.PasswordChallenge;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** Persistence operations for password change codes; every query is scoped to one account or to expiry cleanup. */
public interface PasswordChallengeRepository extends Repository<PasswordChallenge, UUID> {
    PasswordChallenge save(PasswordChallenge challenge);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from PasswordChallenge c where c.id = :id")
    Optional<PasswordChallenge> lockById(@Param("id") UUID id);

    /** Creation times of the account's codes since {@code since}, newest first; used for rate limiting. */
    @Query("""
            select c.createdAt from PasswordChallenge c
            where c.issuer = :issuer and c.subject = :subject and c.createdAt > :since
            order by c.createdAt desc
            """)
    List<Instant> createdSince(@Param("issuer") String issuer, @Param("subject") String subject,
            @Param("since") Instant since, Limit limit);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update PasswordChallenge c set c.status = :superseded, c.updatedAt = :now
            where c.issuer = :issuer and c.subject = :subject and c.status = :pending
            """)
    int supersedePending(@Param("issuer") String issuer, @Param("subject") String subject, @Param("now") Instant now,
            @Param("pending") PasswordChallenge.Status pending,
            @Param("superseded") PasswordChallenge.Status superseded);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from PasswordChallenge c where c.expiresAt < :before")
    int deleteExpiredBefore(@Param("before") Instant before);
}
