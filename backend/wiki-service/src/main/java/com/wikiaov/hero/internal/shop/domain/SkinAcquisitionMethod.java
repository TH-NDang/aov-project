package com.wikiaov.hero.internal.shop.domain;

/** How a skin is obtained on a given day (03, hero shop). Only a voucher skin has a price, only an event skin a name. */
public enum SkinAcquisitionMethod {
    VOUCHER,
    EVENT,
    NOT_OPEN,
    OTHER,
    UNKNOWN
}
