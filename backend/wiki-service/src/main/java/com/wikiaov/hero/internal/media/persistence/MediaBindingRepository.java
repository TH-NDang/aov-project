package com.wikiaov.hero.internal.media.persistence;

import com.wikiaov.hero.internal.media.persistence.entity.MediaBindingRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaBindingRepository extends JpaRepository<MediaBindingRow, MediaBindingRow.Key> {
    List<MediaBindingRow> findByMediaBindingRevisionIdIn(Collection<UUID> ids, Sort sort);
}
