package com.wikiaov.patch.internal.watch.persistence;

import com.wikiaov.patch.internal.watch.domain.PatchNotePostState;
import com.wikiaov.patch.internal.watch.domain.PatchNoteSource;
import com.wikiaov.patch.internal.watch.persistence.entity.PatchNotePost;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PatchNotePostRepository extends JpaRepository<PatchNotePost, UUID> {

    Page<PatchNotePost> findByState(PatchNotePostState state, Pageable page);

    long countByState(PatchNotePostState state);

    boolean existsByUrl(String url);

    @Query("""
            select p.externalId from PatchNotePost p
            where p.source = :source and p.externalId in :externalIds
            """)
    List<String> knownExternalIds(@Param("source") PatchNoteSource source,
            @Param("externalIds") Collection<String> externalIds);
}
