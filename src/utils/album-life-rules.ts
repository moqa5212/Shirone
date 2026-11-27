import path from "node:path";
import type { AlbumLifeConfig } from "@/types/albumsConfig";

export type LifePostMetadata = {
	category?: string | null;
	tags?: string[];
	gallery?: boolean;
	password?: string;
};

function normalizeText(value: string | undefined): string {
	return value?.trim().toLowerCase() ?? "";
}

export function isLifeAlbumPost(
	data: LifePostMetadata,
	life: AlbumLifeConfig,
): boolean {
	if (data.gallery === false) return false;
	if (data.gallery === true) return true;
	if (life.excludeEncrypted && data.password) return false;

	const category = normalizeText(data.category ?? undefined);
	if (
		category &&
		life.excludeCategories.some((value) => normalizeText(value) === category)
	) {
		return false;
	}

	if (
		category &&
		life.includeCategories.some((value) => normalizeText(value) === category)
	) {
		return true;
	}

	const tags = new Set((data.tags ?? []).map(normalizeText));
	return life.includeTags.some((tag) => tags.has(normalizeText(tag)));
}

export function albumPhotoSourceKey(src: string, basePath = ""): string {
	const value = src.trim();
	if (/^https?:\/\//i.test(value)) {
		const url = new URL(value);
		return `${url.host.toLowerCase()}${url.pathname}`;
	}
	const cleanValue = value.split(/[?#]/, 1)[0] ?? value;
	if (cleanValue.startsWith("/")) return cleanValue;
	return path.posix
		.normalize(path.posix.join(basePath.replaceAll(path.sep, "/"), cleanValue))
		.replace(/^\.\//, "");
}
