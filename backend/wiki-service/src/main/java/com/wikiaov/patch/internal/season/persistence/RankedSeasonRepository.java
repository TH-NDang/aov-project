package com.wikiaov.patch.internal.season.persistence;

import com.wikiaov.patch.internal.season.persistence.entity.RankedSeason;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RankedSeasonRepository extends JpaRepository<RankedSeason, UUID> {
    List<RankedSeason> findAllByOrderByOrdinalDesc();
}
