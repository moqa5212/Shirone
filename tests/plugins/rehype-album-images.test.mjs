import assert from "node:assert/strict";
import test from "node:test";
import { fromHtml } from "hast-util-from-html";
import { rehypeAlbumImages } from "../../src/plugins/rehype-album-images.mjs";

async function collect(html) {
	const data = { astro: { frontmatter: {} } };
	await rehypeAlbumImages()(fromHtml(html, { fragment: true }), { data });
	return data.astro.frontmatter.albumImages;
}

test("collects article images with figure captions", async () => {
	const images = await collect(`
		<figure>
			<img src="/images/photo.webp" alt="Lake" title="Morning" />
			<figcaption>Lake at sunrise</figcaption>
		</figure>
	`);
	assert.deepEqual(images, [
		{
			src: "/images/photo.webp",
			alt: "Lake",
			title: "Morning",
			caption: "Lake at sunrise",
		},
	]);
});

test("deduplicates sources and ignores decorative images", async () => {
	const images = await collect(`
		<img src="https://img.eirayun.top/photo.jpg" alt="Remote" />
		<img src="https://img.eirayun.top/photo.jpg" alt="Duplicate" />
		<img src="/icons/icon.svg" alt="" />
		<img src="data:image/png;base64,abc" alt="" />
		<div class="no-album"><img src="/images/hidden.webp" alt="" /></div>
	`);
	assert.equal(images.length, 1);
	assert.equal(images[0].src, "https://img.eirayun.top/photo.jpg");
});
