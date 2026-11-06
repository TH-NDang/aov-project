package com.wikiaov.community.currency.internal.infrastructure;

import com.wikiaov.community.currency.internal.application.ExchangeRateSync;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Refreshes the rates after startup and then on a fixed delay, so time spent stopped is caught up on the next start. */
@Component
@EnableScheduling
@ConditionalOnProperty(name = "community.exchange-rates.enabled", havingValue = "true")
class ExchangeRateWorker {
    private static final Logger log = LoggerFactory.getLogger(ExchangeRateWorker.class);

    private final ExchangeRateSync sync;

    ExchangeRateWorker(ExchangeRateSync sync) {
        this.sync = sync;
    }

    @Scheduled(initialDelayString = "${community.exchange-rates.initial-delay}", fixedDelayString = "${community.exchange-rates.refresh-every}")
    void refresh() {
        try {
            log.info("Stored {} exchange rates.", sync.run());
        } catch (RuntimeException failure) {
            // Stored rates keep working; readers see their date, and the next run tries again.
            log.warn("Exchange rates were not refreshed: {}", failure.getMessage());
        }
    }
}
