import { expect, test } from "@playwright/test";

const SEARCH_PAGES = [
	{ path: "/albums/", selector: ".album-section__search" },
	{ path: "/anime/", selector: ".anime-section__search" },
	{ path: "/compass/", selector: ".compass-section__search" },
	{ path: "/devices/", selector: ".devices-section__search" },
	{ path: "/friends/", selector: ".friend-section__search" },
	{ path: "/games/", selector: ".games-section__search" },
	{ path: "/moments/", selector: ".moment-section__search" },
	{ path: "/projects/", selector: ".projects-section__search" },
];

test("页面内搜索框在单侧栏正文内统一加宽", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });

	for (const { path, selector } of SEARCH_PAGES) {
		await page.goto(path, { waitUntil: "domcontentloaded" });

		const search = page.locator(selector);
		await expect(search, `${path} 搜索框未渲染`).toBeVisible();
		await expect
			.poll(
				() =>
					page.evaluate((searchSelector) => {
						const searchElement = document.querySelector(searchSelector);
						const grid = document.getElementById("main-grid");
						const content = document.getElementById("main-content-column");
						if (!searchElement || !grid || !content) return null;
						return {
							layout: grid.dataset.sidebarLayout,
							searchWidth: searchElement.getBoundingClientRect().width,
							contentWidth: content.getBoundingClientRect().width,
						};
					}, selector),
				{ message: `${path} 搜索框宽度尚未稳定` },
			)
			.toEqual(
				expect.objectContaining({
					layout: "single",
				}),
			);

		const geometry = await page.evaluate((searchSelector) => {
			const searchElement = document.querySelector(searchSelector);
			const content = document.getElementById("main-content-column");
			if (!searchElement || !content) {
				throw new Error("search geometry elements are missing");
			}
			return {
				searchWidth: searchElement.getBoundingClientRect().width,
				contentWidth: content.getBoundingClientRect().width,
			};
		}, selector);

		expect(geometry.searchWidth, `${path} 搜索框仍未适配正文`).toBeGreaterThan(
			800,
		);
		expect(geometry.searchWidth).toBeLessThanOrEqual(geometry.contentWidth);
	}
});
