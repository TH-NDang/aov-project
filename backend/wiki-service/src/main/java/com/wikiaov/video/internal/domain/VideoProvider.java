package com.wikiaov.video.internal.domain;

/** Where the video is hosted. Frontends decide from the link whether it can play in the page. */
public enum VideoProvider {
    YOUTUBE,
    FACEBOOK,
    TIKTOK,
    TWITCH,
    OTHER
}
