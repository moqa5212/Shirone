import assert from "node:assert/strict";
import test from "node:test";
import { parseExifTakenAt } from "../../src/utils/album-photo-date.ts";

function createExifBuffer(dateValue, little = true) {
	const buffer = Buffer.alloc(6 + 56 + 20);
	buffer.write("Exif\0\0", 0, "ascii");
	const base = 6;
	buffer.write(little ? "II" : "MM", base, "ascii");
	const u16 = (value, offset) =>
		little
			? buffer.writeUInt16LE(value, offset)
			: buffer.writeUInt16BE(value, offset);
	const u32 = (value, offset) =>
		little
			? buffer.writeUInt32LE(value, offset)
			: buffer.writeUInt32BE(value, offset);

	u16(42, base + 2);
	u32(8, base + 4);

	const ifd0 = base + 8;
	u16(1, ifd0);
	u16(0x8769, ifd0 + 2);
	u16(4, ifd0 + 4);
	u32(1, ifd0 + 6);
	u32(32, ifd0 + 10);
	u32(0, ifd0 + 14);

	const exifIfd = base + 32;
	u16(1, exifIfd);
	u16(0x9003, exifIfd + 2);
	u16(2, exifIfd + 4);
	u32(20, exifIfd + 6);
	u32(56, exifIfd + 10);
	u32(0, exifIfd + 14);

	buffer.write(dateValue.padEnd(20, "\0"), base + 56, "ascii");
	return buffer;
}

test("parses DateTimeOriginal from little-endian EXIF", () => {
	assert.equal(
		parseExifTakenAt(createExifBuffer("2026:04:11 18:30:00")),
		"2026-04-11",
	);
});

test("parses big-endian EXIF and rejects invalid calendar dates", () => {
	assert.equal(
		parseExifTakenAt(createExifBuffer("2026:04:12 08:00:00", false)),
		"2026-04-12",
	);
	assert.equal(
		parseExifTakenAt(createExifBuffer("2026:02:31 08:00:00")),
		undefined,
	);
});
