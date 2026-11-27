import assert from "node:assert/strict";
import test from "node:test";
import {
	albumPhotoSourceKey,
	isLifeAlbumPost,
} from "../../src/utils/album-life-rules.ts";

const life = {
	enable: true,
	title: "Life",
	description: "Life photos",
	includeCategories: ["生活", "旅行", "摄影"],
	includeTags: ["life", "travel"],
	excludeCategories: ["教程", "开发"],
	excludeEncrypted: true,
};

test("category and tag rules determine Life inclusion", () => {
	assert.equal(isLifeAlbumPost({ category: "旅行", tags: [] }, life), true);
	assert.equal(
		isLifeAlbumPost({ category: "Guide", tags: ["travel"] }, life),
		true,
	);
	assert.equal(isLifeAlbumPost({ category: "Guide", tags: [] }, life), false);
});

test("encrypted and excluded posts stay out of Life by default", () => {
	assert.equal(
		isLifeAlbumPost({ category: "旅行", tags: [], password: "secret" }, life),
		false,
	);
	assert.equal(isLifeAlbumPost({ category: "教程", tags: [] }, life), false);
});

test("category and tag matching is trimmed and case-insensitive", () => {
	assert.equal(isLifeAlbumPost({ category: " 摄影 ", tags: [] }, life), true);
	assert.equal(
		isLifeAlbumPost({ category: "Guide", tags: [" Travel "] }, life),
		true,
	);
	assert.equal(
		isLifeAlbumPost({ category: "Guide", tags: ["Markdown"] }, life),
		false,
	);
});

test("source keys normalize remote URLs and relative post paths", () => {
	assert.equal(
		albumPhotoSourceKey("https://IMG.Eirayun.top/photo.webp?width=800#view"),
		"img.eirayun.top/photo.webp",
	);
	assert.equal(
		albumPhotoSourceKey("../images/photo.webp?size=2", "content/posts/trip"),
		"content/posts/images/photo.webp",
	);
	assert.equal(
		albumPhotoSourceKey("/images/photo.webp#hero"),
		"/images/photo.webp",
	);
});
