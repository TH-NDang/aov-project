package com.wikiaov.community.community.internal.social.persistence;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(schema = "community", name = "follow")
public class PageFollow {
    @Id
    private UUID id;
    private UUID pageId;
    private String actor;

    public PageFollow() {
        this.id = UUID.randomUUID();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID value) {
        this.id = value;
    }

    public UUID getPageId() {
        return pageId;
    }

    public void setPageId(UUID value) {
        this.pageId = value;
    }

    public String getActor() {
        return actor;
    }

    public void setActor(String value) {
        this.actor = value;
    }

}
