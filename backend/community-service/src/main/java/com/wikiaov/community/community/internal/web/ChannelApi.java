package com.wikiaov.community.community.internal.web;

import com.wikiaov.community.community.internal.channels.application.ChannelViews.Channel;
import com.wikiaov.community.community.internal.channels.application.ChannelViews.VideoPage;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;

@Tag(name = "pages")
public interface ChannelApi {
    @Operation(operationId = "channelApi_channel", summary = "YouTube channel of a page", description = "Public. The YouTube channel behind one of a published page's links, given as `url` exactly as the page lists it: its name, handle, pictures and counts (from the YouTube Data API, absent when it is off) and its newest uploads (from the channel feed). `more` says whether older uploads can be asked for. Answers are kept up to a day for the channel and 30 minutes for the videos.", responses = {
            @ApiResponse(responseCode = "200", description = "The channel with its newest uploads.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "400", description = "`url` is missing or too long, or the query has an unknown parameter.", content = @Content(mediaType = "application/problem+json", schema = @Schema(implementation = ProblemDetail.class))),
            @ApiResponse(responseCode = "404", description = "`PAGE_NOT_FOUND`: no such published page. `CHANNEL_NOT_FOUND`: the page has no such link, the link is not a YouTube channel, or YouTube has no channel there.", content = @Content(mediaType = "application/problem+json", schema = @Schema(implementation = ProblemDetail.class))),
            @ApiResponse(responseCode = "503", description = "`CHANNEL_UNAVAILABLE`: YouTube cannot be read now, or the channel is linked by a handle while the Data API is off or its quota is spent.", content = @Content(mediaType = "application/problem+json", schema = @Schema(implementation = ProblemDetail.class)))
    })
    ResponseEntity<Channel> channel(UUID id, @Parameter(description = "The link, as the page lists it.") String url);

    @Operation(operationId = "channelApi_videos", summary = "Older uploads of a page's YouTube channel", description = "Public. Uploads of the channel behind one of the page's links, newest first, 24 at a time, from the YouTube Data API. Without `pageToken` the list starts from the newest upload, so it repeats the videos of the channel answer; clients drop the ones they already show. `nextPageToken` asks for the next part and is absent at the end.", responses = {
            @ApiResponse(responseCode = "200", description = "A part of the uploads.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "400", description = "`url` is missing or too long, `pageToken` is malformed, or the query has an unknown parameter.", content = @Content(mediaType = "application/problem+json", schema = @Schema(implementation = ProblemDetail.class))),
            @ApiResponse(responseCode = "404", description = "As for the channel.", content = @Content(mediaType = "application/problem+json", schema = @Schema(implementation = ProblemDetail.class))),
            @ApiResponse(responseCode = "503", description = "`CHANNEL_UNAVAILABLE`: the Data API is off, its quota is spent or YouTube cannot be read now.", content = @Content(mediaType = "application/problem+json", schema = @Schema(implementation = ProblemDetail.class)))
    })
    ResponseEntity<VideoPage> videos(UUID id, @Parameter(description = "The link, as the page lists it.") String url,
            @Parameter(description = "The `nextPageToken` of the previous part.") String pageToken);
}
