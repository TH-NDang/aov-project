package com.wikiaov.community.currency.internal.application;

import java.time.Clock;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(ExchangeRateSettings.class)
class ExchangeRateConfiguration {
    @Bean
    Clock exchangeRateClock() {
        return Clock.systemUTC();
    }
}
