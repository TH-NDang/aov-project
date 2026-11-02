package com.wikiaov.community.community.internal.social.persistence;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface PageNotificationRepository extends JpaRepository<PageNotification, UUID> {

    Page<PageNotification> findByActorOrderByCreatedAtDesc(String actor, Pageable pageable);
}
