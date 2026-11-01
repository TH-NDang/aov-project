package com.wikiaov.media.internal.deletion.application.port;

import java.util.UUID;

public interface CompetitionMediaGuard {
    void requireUnused(UUID assetId);

    void retire(UUID assetId);
}
