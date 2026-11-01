package com.wikiaov.media.internal.deletion.application.port;

import java.util.List;

public interface MediaCachePurge {
    void requireConfigured();

    void purge(List<String> publicUrls);
}
