package com.wikiaov.community.community.internal.social.persistence;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface CommunityCommentRepository extends JpaRepository<CommunityComment, UUID> {

    Page<CommunityComment> findByPostIdAndHiddenFalseOrderByCreatedAtAsc(UUID postId, Pageable pageable);
}
