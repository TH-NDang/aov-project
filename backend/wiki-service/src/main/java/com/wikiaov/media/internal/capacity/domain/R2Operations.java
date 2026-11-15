package com.wikiaov.media.internal.capacity.domain;

import java.util.Set;

/**
 * Cloudflare R2 operation classes (pricing page, read 2026-11-14) and the operations one stored file costs here.
 *
 * <p>Every new file costs 2 class A operations (the presigned PUT to {@code incoming/} and the CopyObject to its
 * final key) and 2 class B operations (HeadObject and the GetObject that validates it). Deleting is free.
 */
public final class R2Operations {

    public static final int CLASS_A_PER_STORED_FILE = 2;
    public static final int CLASS_B_PER_STORED_FILE = 2;

    private static final Set<String> CLASS_B = Set.of("HeadBucket", "HeadObject", "GetObject", "UsageSummary",
            "GetBucketEncryption", "GetBucketLocation", "GetBucketCors", "GetBucketLifecycleConfiguration");
    private static final Set<String> FREE = Set.of("DeleteObject", "DeleteObjects", "DeleteBucket",
            "AbortMultipartUpload");

    /** The billing class of an operation name as Cloudflare analytics reports it. */
    public enum OperationClass {
        CLASS_A,
        CLASS_B,
        FREE
    }

    private R2Operations() {
    }

    /** Unknown names count as class A, the dearer class, so the warning comes early rather than late. */
    public static OperationClass classify(String actionType) {
        if (FREE.contains(actionType)) {
            return OperationClass.FREE;
        }
        if (CLASS_B.contains(actionType) || actionType.startsWith("Get") || actionType.startsWith("Head")) {
            return OperationClass.CLASS_B;
        }
        return OperationClass.CLASS_A;
    }
}
