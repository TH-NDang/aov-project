package com.wikiaov.community.tournament.internal.games.persistence;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PublicationRepository extends JpaRepository<PublicationRecord, UUID> {
}
