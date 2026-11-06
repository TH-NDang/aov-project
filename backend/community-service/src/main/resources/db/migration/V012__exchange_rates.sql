-- One row per currency per day, kept for good so an old prize can be read at the rate of its own day.
CREATE SCHEMA currency;

CREATE TABLE currency.exchange_rate (
    currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    rate_date date NOT NULL,
    units_per_usd numeric(20, 8) NOT NULL CHECK (units_per_usd > 0),
    source varchar(40) NOT NULL,
    fetched_at timestamptz NOT NULL,
    PRIMARY KEY (currency, rate_date)
);
