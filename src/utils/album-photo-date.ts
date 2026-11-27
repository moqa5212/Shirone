import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const EXIF_IFD_POINTER = 0x8769;
const DATE_TIME_ORIGINAL = 0x9003;
const DATE_TIME_DIGITIZED = 0x9004;

type IfdEntry = {
	count: number;
	little: boolean;
	type: number;
	valueFieldOffset: number;
};

function readUInt16(buffer: Buffer, offset: number, little: boolean): number {
	return little ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
}

function readUInt32(buffer: Buffer, offset: number, little: boolean): number {
	return little ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
}

function readAscii(buffer: Buffer, base: number, entry: IfdEntry): string {
	const valueOffset =
		entry.count <= 4
			? entry.valueFieldOffset
			: base + readUInt32(buffer, entry.valueFieldOffset, entry.little);
	if (valueOffset < 0 || valueOffset + entry.count > buffer.length) return "";
	return buffer
		.toString("ascii", valueOffset, valueOffset + entry.count)
		.replace(/\0.*$/, "")
		.trim();
}

function readIfd(
	buffer: Buffer,
	base: number,
	relativeOffset: number,
	little: boolean,
): Map<number, IfdEntry> {
	const entries = new Map<number, IfdEntry>();
	const offset = base + relativeOffset;
	if (offset < 0 || offset + 2 > buffer.length) return entries;

	const count = readUInt16(buffer, offset, little);
	if (count > 512 || offset + 2 + count * 12 > buffer.length) return entries;

	for (let index = 0; index < count; index += 1) {
		const entryOffset = offset + 2 + index * 12;
		entries.set(readUInt16(buffer, entryOffset, little), {
			type: readUInt16(buffer, entryOffset + 2, little),
			count: readUInt32(buffer, entryOffset + 4, little),
			valueFieldOffset: entryOffset + 8,
			little,
		});
	}
	return entries;
}

function normalizeExifDate(value: string): string | undefined {
	const match = value.match(/^(\d{4})[:-](\d{2})[:-](\d{2})/);
	if (!match) return undefined;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));
	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== day
	) {
		return undefined;
	}
	return `${match[1]}-${match[2]}-${match[3]}`;
}

export function parseExifTakenAt(value: Uint8Array): string | undefined {
	try {
		const buffer = Buffer.from(value);
		let base = 0;
		if (buffer.toString("ascii", 0, 6) === "Exif\0\0") base = 6;

		const byteOrder = buffer.toString("ascii", base, base + 2);
		const little = byteOrder === "II";
		if (!little && byteOrder !== "MM") return undefined;
		if (readUInt16(buffer, base + 2, little) !== 42) return undefined;

		const ifd0 = readIfd(
			buffer,
			base,
			readUInt32(buffer, base + 4, little),
			little,
		);
		const exifPointer = ifd0.get(EXIF_IFD_POINTER);
		if (exifPointer?.type !== 4 || exifPointer.count < 1) return undefined;

		const exifIfd = readIfd(
			buffer,
			base,
			readUInt32(buffer, exifPointer.valueFieldOffset, little),
			little,
		);
		for (const tag of [DATE_TIME_ORIGINAL, DATE_TIME_DIGITIZED]) {
			const entry = exifIfd.get(tag);
			if (entry?.type !== 2) continue;
			const date = normalizeExifDate(readAscii(buffer, base, entry));
			if (date) return date;
		}
	} catch {
		return undefined;
	}
	return undefined;
}

function resolveLocalImagePath(
	src: string,
	basePath: string,
): string | undefined {
	const cleanSource = src.trim().split(/[?#]/, 1)[0] ?? src.trim();
	if (
		!cleanSource ||
		/^(?:data:|blob:|https?:)/i.test(cleanSource) ||
		cleanSource.startsWith("//")
	) {
		return undefined;
	}
	if (cleanSource.startsWith("/")) {
		return path.join(process.cwd(), "public", cleanSource.slice(1));
	}
	return path.resolve(
		process.cwd(),
		"src",
		basePath.replaceAll(path.sep, "/"),
		cleanSource,
	);
}

export async function readImageExifTakenAt(
	src: string,
	basePath: string,
): Promise<string | undefined> {
	const imagePath = resolveLocalImagePath(src, basePath);
	if (!imagePath) return undefined;

	try {
		await fs.access(imagePath);
		const metadata = await sharp(imagePath, { failOn: "none" }).metadata();
		return metadata.exif ? parseExifTakenAt(metadata.exif) : undefined;
	} catch {
		return undefined;
	}
}
