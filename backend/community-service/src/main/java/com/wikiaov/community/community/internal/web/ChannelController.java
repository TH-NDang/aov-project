package com.wikiaov.community.community.internal.web;

import com.wikiaov.community.community.internal.channels.application.ChannelViews.Channel;
import com.wikiaov.community.community.internal.channels.application.ChannelViews.VideoPage;
import com.wikiaov.community.community.internal.channels.application.PageChannels;
import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
class ChannelController implements ChannelApi {
    /** Browsers keep an answer a few minutes; the service keeps its own for longer. */
    private static final CacheControl KEPT = CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic();
    private final PageChannels channels;
    private final HttpServletRequest request;

    ChannelController(PageChannels channels, HttpServletRequest request) {
        this.channels = channels;
        this.request = request;
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/pages/{id}/youtube-channel", version = "1")
    public ResponseEntity<Channel> channel(@PathVariable UUID id, @RequestParam String url) {
        QueryParameters.requireOnly(request, Set.of("url"));
        return ResponseEntity.ok().cacheControl(KEPT).body(channels.channel(id, url));
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/pages/{id}/youtube-channel/videos", version = "1")
    public ResponseEntity<VideoPage> videos(@PathVariable UUID id, @RequestParam String url,
            @RequestParam(required = false) String pageToken) {
        QueryParameters.requireOnly(request, Set.of("url", "pageToken"));
        return ResponseEntity.ok().cacheControl(KEPT).body(channels.videos(id, url, pageToken));
    }
}
