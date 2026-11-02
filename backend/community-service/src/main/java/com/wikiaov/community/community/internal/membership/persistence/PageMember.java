package com.wikiaov.community.community.internal.membership.persistence;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(schema = "community", name = "page_member")
public class PageMember {
    @Id
    private UUID id;
    private UUID pageId;
    private String actor;
    private String name;
    private String role;

    public PageMember() {
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

    public String getName() {
        return name;
    }

    public void setName(String value) {
        this.name = value;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String value) {
        this.role = value;
    }

}
