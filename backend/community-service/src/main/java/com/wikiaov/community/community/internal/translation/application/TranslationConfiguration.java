package com.wikiaov.community.community.internal.translation.application;

import java.time.Clock;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(TranslationSettings.class)
class TranslationConfiguration {
    @Bean
    TranslationLimiter translationLimiter(TranslationSettings settings) {
        return new TranslationLimiter(settings.hourlyPerRequester(), Clock.systemUTC());
    }
}
