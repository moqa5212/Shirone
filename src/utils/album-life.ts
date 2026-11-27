import type { CollectionEntry } from "astro:content";
import { render } from "astro:content";
import { createHash } from "node:crypto";
import path from "node:path";
import { albumPhotoSourceKey, isLifeAlbumPost } from "@utils/album-life-rules";
import { readImageExifTakenAt } from "@utils/album-photo-date";
import { resolveAsset, resolveImageAsset } from "@utils/asset-utils";
import { getSortedMoments, getSortedPosts } from "@utils/content-utils";
import { getPostUrl, url } from "@utils/url-utils";
import { albumsConfig } from "@/config/albumsConfig";
import { momentsConfig } from "@/config/momentsConfig";
import type { AlbumGroup, AlbumPhoto } from "@/types/album";

type RawAlbumImage = {
	src: string;
	alt: string;
	title: string;
	caption: string;
};

type AlbumPhotoOverride = NonNullable<
	CollectionEntry<"posts">["data"]["galleryPhotos"]
>[number];

function unique(values: string[]): string[] {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function overrideKey(
	override: AlbumPhotoOverride,
	post: CollectionEntry<"posts">,
): string {
	const basePath = post.filePath
		? path.relative(path.resolve("src"), path.dirname(post.filePath))
		: "content/posts";
	return albumPhotoSourceKey(override.src, basePath);
}

async function resolvePhotoSource(
	src: string,
	basePath: string,
): Promise<{ src: string; width?: number; height?: number }> {
	const asset = await resolveImageAsset(src, basePath);
	if (typeof asset !== "string") {
		return { src: asset.src, width: asset.width, height: asset.height };
	}
	return { src: await resolveAsset(src, basePath) };
}

export async function collectLifeAlbum({
	title,
	description,
}: {
	title: string;
	description: string;
}): Promise<AlbumGroup> {
	const posts = await getSortedPosts();
	const photos: AlbumPhoto[] = [];
	const seen = new Set<string>();

	for (const post of posts) {
		if (!isLifeAlbumPost(post.data, albumsConfig.life)) continue;
		const { remarkPluginFrontmatter } = await render(post);
		const images = (remarkPluginFrontmatter.albumImages ??
			[]) as RawAlbumImage[];
		if (images.length === 0) continue;

		const basePath = post.filePath
			? path.relative(path.resolve("src"), path.dirname(post.filePath))
			: "content/posts";
		const overrides = new Map<string, AlbumPhotoOverride>(
			(post.data.galleryPhotos ?? []).map((override) => [
				overrideKey(override, post),
				override,
			]),
		);
		const published = post.data.published.toISOString().slice(0, 10);
		const postUrl = getPostUrl(post);

		for (const image of images) {
			const key = albumPhotoSourceKey(image.src, basePath);
			const override = overrides.get(key);
			if (override?.exclude || seen.has(key)) continue;
			seen.add(key);

			const resolved = await resolvePhotoSource(image.src, basePath);
			const exifDate = override?.takenAt
				? undefined
				: await readImageExifTakenAt(image.src, basePath);
			const titleText =
				override?.title?.trim() ||
				image.title ||
				image.caption ||
				image.alt ||
				post.data.title;
			const date =
				override?.takenAt?.toISOString().slice(0, 10) || exifDate || published;
			photos.push({
				id: `life-${createHash("sha1").update(key).digest("hex").slice(0, 12)}`,
				src: resolved.src,
				thumbnail: resolved.src,
				alt: image.alt || titleText,
				title: titleText,
				tags: unique([...(post.data.tags ?? []), ...(override?.tags ?? [])]),
				location: override?.location?.trim() || post.data.location || undefined,
				date,
				postUrl,
				width: resolved.width,
				height: resolved.height,
			});
		}
	}

	if (momentsConfig.enable) {
		const moments = await getSortedMoments();
		for (const moment of moments) {
			if (moment.encrypted) continue;
			const date = moment.published.slice(0, 10);

			for (const image of moment.images) {
				const key = albumPhotoSourceKey(image.src);
				if (seen.has(key)) continue;
				seen.add(key);

				const title = image.alt || moment.location || moment.tags[0] || "Moment";
				photos.push({
					id: `life-moment-${createHash("sha1")
						.update(`${moment.id}:${key}`)
						.digest("hex")
						.slice(0, 12)}`,
					src: image.src,
					thumbnail: image.thumbnailSrc ?? image.src,
					alt: image.alt || title,
					title,
					tags: unique(moment.tags),
					location: moment.location || undefined,
					date,
					postUrl: url(`/moments/#moment-${moment.id}`),
				});
			}
		}
	}

	photos.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
	return {
		id: "life",
		title,
		description,
		cover: photos[0]?.src ?? "",
		date: photos[0]?.date ?? new Date().toISOString().slice(0, 10),
		location: "",
		tags: unique(photos.flatMap((photo) => photo.tags)),
		layout: "masonry",
		columns: 3,
		hidden: false,
		photos,
	};
}

export function mergeAlbumsWithLife(
	albums: AlbumGroup[],
	lifeAlbum?: AlbumGroup,
): AlbumGroup[] {
	const sortedAlbums = [...albums].sort(
		(a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title),
	);
	if (!lifeAlbum) {
		return sortedAlbums;
	}
	return [lifeAlbum, ...sortedAlbums.filter((album) => album.id !== lifeAlbum.id)];
}
