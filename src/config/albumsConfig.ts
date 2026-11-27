import type { AlbumsConfig } from "../types/albumsConfig.ts";
import { withUserConfig } from "../utils/config-overlay.ts";

export const albumsConfig: AlbumsConfig = withUserConfig("albums", {
	enable: true,
	title: "$t:albums",
	description: "$t:albumsBanner",
	// 文章照片自动汇总成的 Life 照片集（/albums/life/）；关闭时不读取文章、不生成路由。
	life: {
		enable: true,
		title: "$t:albumLife",
		description: "$t:albumLifeBanner",
		// 文章 category 命中任一项即收录（trim + 忽略大小写），frontmatter `gallery` 可显式覆盖。
		includeCategories: ["生活", "旅行", "摄影", "日常"],
		// 文章 tags 命中任一项即收录（与 category 规则取并集）。
		includeTags: ["life", "travel", "photography"],
		// category 命中任一项即排除；显式 `gallery: true` 仍可强制收录。
		excludeCategories: ["教程", "开发", "学习笔记"],
		// 默认排除加密文章，避免把需要密码的内容汇总进公开照片集。
		excludeEncrypted: true,
	},
});
