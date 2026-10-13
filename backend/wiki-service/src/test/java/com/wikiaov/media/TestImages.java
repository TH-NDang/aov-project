package com.wikiaov.media;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import javax.imageio.ImageIO;

/** Image bytes for tests. PNG and JPEG are real encoder output; WebP files carry a valid header only. */
public final class TestImages {

    private TestImages() {
    }

    public static byte[] png(int width, int height) {
        return encode("png", width, height, BufferedImage.TYPE_INT_ARGB);
    }

    public static byte[] jpeg(int width, int height) {
        return encode("jpg", width, height, BufferedImage.TYPE_INT_RGB);
    }

    /** Lossless WebP: VP8L signature 0x2F, then width-1 and height-1 as 14-bit fields. */
    public static byte[] webpLossless(int width, int height) {
        ByteBuffer chunk = little(16).put((byte) 0x2F).putInt((width - 1) | ((height - 1) << 14));
        return riff("VP8L", chunk.array());
    }

    /** Lossy WebP: VP8 frame tag, start code 9D 01 2A, then 14-bit width and height. */
    public static byte[] webpLossy(int width, int height) {
        ByteBuffer chunk = little(20).put(new byte[] {0x50, 0x01, 0x00, (byte) 0x9D, 0x01, 0x2A})
                .putShort((short) width).putShort((short) height);
        return riff("VP8 ", chunk.array());
    }

    /** Extended WebP: VP8X flags, 3 reserved bytes, then 24-bit width-1 and height-1. */
    public static byte[] webpExtended(int width, int height) {
        ByteBuffer chunk = little(10).put(new byte[4]);
        put24(chunk, width - 1);
        put24(chunk, height - 1);
        return riff("VP8X", chunk.array());
    }

    private static byte[] riff(String chunkType, byte[] chunkData) {
        ByteBuffer file = little(20 + chunkData.length)
                .put("RIFF".getBytes(StandardCharsets.US_ASCII))
                .putInt(12 + chunkData.length)
                .put("WEBP".getBytes(StandardCharsets.US_ASCII))
                .put(chunkType.getBytes(StandardCharsets.US_ASCII))
                .putInt(chunkData.length)
                .put(chunkData);
        return file.array();
    }

    private static ByteBuffer little(int size) {
        return ByteBuffer.allocate(size).order(ByteOrder.LITTLE_ENDIAN);
    }

    private static void put24(ByteBuffer buffer, int value) {
        buffer.put((byte) value).put((byte) (value >> 8)).put((byte) (value >> 16));
    }

    private static byte[] encode(String format, int width, int height, int type) {
        BufferedImage image = new BufferedImage(width, height, type);
        for (int x = 0; x < width; x++) {
            for (int y = 0; y < height; y++) {
                image.setRGB(x, y, new Color((x * 37) % 256, (y * 53) % 256, 120).getRGB());
            }
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            if (!ImageIO.write(image, format, out)) {
                throw new IllegalStateException("No ImageIO writer for " + format);
            }
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
        return out.toByteArray();
    }
}
