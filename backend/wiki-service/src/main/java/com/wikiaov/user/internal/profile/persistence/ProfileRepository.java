package com.wikiaov.user.internal.profile.persistence;

import com.wikiaov.user.internal.profile.persistence.entity.Profile;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** Exposes only the persistence operations needed by the user module. */
public interface ProfileRepository extends Repository<Profile, UUID> {
    Optional<Profile> findByIssuerAndSubject(String issuer, String subject);

    Optional<Profile> findById(UUID id);

    Profile saveAndFlush(Profile profile);

    @Query("select p from Profile p where locate(lower(:search), lower(p.displayName)) > 0")
    Page<Profile> search(@Param("search") String search, Pageable pageable);

    @Query("select p.id from Profile p where p.avatarAssetId = :assetId")
    List<UUID> avatarOwners(@Param("assetId") UUID assetId);
}
