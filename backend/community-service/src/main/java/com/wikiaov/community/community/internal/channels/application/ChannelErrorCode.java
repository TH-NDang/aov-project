package com.wikiaov.community.community.internal.channels.application;

import com.wikiaov.community.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;

public enum ChannelErrorCode implements ApiErrorCode {
    /** The page is not published, has no such link, or the link names no YouTube channel that exists. */
    CHANNEL_NOT_FOUND(HttpStatus.NOT_FOUND),
    /** YouTube could not be read now, or reading this channel needs the Data API, which is off or spent for today. */
    CHANNEL_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE);

    private final HttpStatus status;

    ChannelErrorCode(HttpStatus status) {
        this.status = status;
    }

    @Override
    public HttpStatus status() {
        return status;
    }

    @Override
    public String title() {
        return "Channel request failed";
    }
}
