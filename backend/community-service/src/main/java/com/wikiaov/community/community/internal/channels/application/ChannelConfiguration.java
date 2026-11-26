package com.wikiaov.community.community.internal.channels.application;

import java.time.Clock;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(YouTubeSettings.class)
class ChannelConfiguration {
    /** The day's Data API budget, counted on the system clock. */
    @Bean
    YouTubeBudget youTubeBudget(YouTubeSettings settings) {
        return new YouTubeBudget(settings.dailyUnits(), Clock.systemUTC());
    }
}
