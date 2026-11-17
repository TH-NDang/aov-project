package com.wikiaov.community.tournament.internal.media.application;

import com.wikiaov.community.tournament.CompetitionAssets;
import com.wikiaov.community.tournament.internal.archive.persistence.RegistryWriteGuard;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Transactional
public class CompetitionAssetAccess implements CompetitionAssets {
    private final CompetitionMedia media;
    private final RegistryWriteGuard writes;

    public CompetitionAssetAccess(CompetitionMedia media, RegistryWriteGuard writes) {
        this.media = media;
        this.writes = writes;
    }

    @Override
    public void acquire(String... urls) {
        writes.acquire();
        for (String url : urls) {
            media.requireAvailable(url);
        }
    }
}
