package com.wikiaov.community.community.internal.channels.application;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(YouTubeSettings.class)
class ChannelConfiguration {
}
