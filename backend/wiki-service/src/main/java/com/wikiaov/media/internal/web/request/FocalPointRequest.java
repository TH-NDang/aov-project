package com.wikiaov.media.internal.web.request;

import com.wikiaov.media.MediaAssetReference;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

/** A point of a picture, as fractions of its width and height from the top left. */
public record FocalPointRequest(
        @NotNull @DecimalMin("0") @DecimalMax("1") Double x,
        @NotNull @DecimalMin("0") @DecimalMax("1") Double y
) {

    public MediaAssetReference.FocalPoint toPoint() {
        return new MediaAssetReference.FocalPoint(x, y);
    }
}
