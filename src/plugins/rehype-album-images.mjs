/**
 * Collect article body images for the generated Life album. Sources remain
 * relative here so they can be resolved against the post file path later.
 */

const PHOTO_EXTENSION = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#]|$)/i;

function classNames(node) {
	const value = node?.properties?.className ?? node?.properties?.class;
	if (Array.isArray(value)) return value.map(String);
	return typeof value === "string" ? value.split(/\s+/).filter(Boolean) : [];
}

function textContent(node) {
	if (!node) return "";
	if (node.type === "text") return node.value ?? "";
	return (node.children ?? []).map(textContent).join("");
}

function nearestFigureCaption(ancestors) {
	for (let index = ancestors.length - 1; index >= 0; index -= 1) {
		const node = ancestors[index];
		if (node?.tagName !== "figure") continue;
		const caption = (node.children ?? []).find(
			(child) => child?.tagName === "figcaption",
		);
		return textContent(caption).replace(/\s+/g, " ").trim();
	}
	return "";
}

function isPhotoCandidate(src, ancestors) {
	if (!src || /^(?:data:|blob:)/i.test(src)) return false;
	if (/\.svg(?:[?#]|$)/i.test(src)) return false;
	if (!/^https?:\/\//i.test(src) && !PHOTO_EXTENSION.test(src)) return false;
	return !ancestors.some((node) =>
		classNames(node).some((name) =>
			["markdown-mermaid", "no-album", "no-gallery", "no-enhance"].includes(
				name,
			),
		),
	);
}

export function rehypeAlbumImages() {
	return (tree, file) => {
		const images = [];
		const seen = new Set();

		const visit = (node, ancestors = []) => {
			if (node?.type === "element" && node.tagName === "img") {
				const src = String(node.properties?.src ?? "").trim();
				if (isPhotoCandidate(src, ancestors) && !seen.has(src)) {
					seen.add(src);
					images.push({
						src,
						alt: String(node.properties?.alt ?? "").trim(),
						title: String(node.properties?.title ?? "").trim(),
						caption: nearestFigureCaption(ancestors),
					});
				}
				return;
			}
			for (const child of node?.children ?? []) {
				visit(child, [...ancestors, node]);
			}
		};

		visit(tree);
		file.data.astro ??= {};
		file.data.astro.frontmatter ??= {};
		file.data.astro.frontmatter.albumImages = images;
	};
}
