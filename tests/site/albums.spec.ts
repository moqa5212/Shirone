import { expect, type Page, test } from "@playwright/test";

/**
 * Album fixtures use picsum.photos for their remote images. Answer them with a
 * local SVG of the requested aspect ratio so layout assertions do not depend on
 * an external host being reachable or fast.
 */
async function mockRemoteAlbumImages(page: Page) {
	await page.route("https://picsum.photos/**", (route) => {
		const match = /\/(\d+)\/(\d+)$/.exec(
			new URL(route.request().url()).pathname,
		);
		const width = Number(match?.[1] ?? 800);
		const height = Number(match?.[2] ?? 600);
		return route.fulfill({
			contentType: "image/svg+xml",
			body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#8a8a8a"/></svg>`,
		});
	});
}

test.beforeEach(async ({ page }) => {
	await mockRemoteAlbumImages(page);
});

test.describe("相册页响应式滚动", () => {
	test("从手机视口切换到桌面视口后仍可滚动", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto("/albums/AcgExample/", { waitUntil: "networkidle" });
		await expect(page.locator(".album-gallery__item").first()).toBeVisible();
		await expect(page.locator(".album-gallery__toolbar")).toBeVisible();
		await expect(page.locator(".album-gallery__name").first()).toBeVisible();
		await expect(page.locator(".album-gallery__date").first()).toHaveText(
			/^\d{4}\.\d{2}\.\d{2}$/,
		);

		await page.setViewportSize({ width: 1440, height: 900 });
		await expect
			.poll(() =>
				page.evaluate(
					() => document.documentElement.scrollHeight > window.innerHeight,
				),
			)
			.toBe(true);

		await page.evaluate(() => window.scrollTo(0, 700));
		await expect
			.poll(() => page.evaluate(() => window.scrollY))
			.toBeGreaterThan(0);

		await expect(page.locator("html")).not.toHaveAttribute(
			"data-overlayscrollbars",
		);
		await expect(page.locator("body")).not.toHaveAttribute(
			"data-overlayscrollbars",
		);
	});
});

test.describe("相册图片灯箱", () => {
	test("从点击的图片开始显示，而不是始终打开第一张", async ({ page }) => {
		await page.goto("/albums/AcgExample/", { waitUntil: "networkidle" });

		const photos = page.locator(".album-gallery__item");
		await expect(photos.nth(1)).toBeVisible();
		const photoCount = await photos.count();
		const selectedAlt = await photos.nth(1).locator("img").getAttribute("alt");

		await photos.nth(1).click();

		const dialog = page.locator(".fancybox__container.is-ready");
		await expect(dialog).toBeVisible({ timeout: 15_000 });
		await expect(dialog.locator(".f-counter")).toHaveText(`2/${photoCount}`);
		await expect(
			dialog.locator(".fancybox__slide.is-selected img:not(.is-clone)"),
		).toHaveAttribute("alt", selectedAlt ?? "");
	});
});

test.describe("Life 生活照片集", () => {
	test("作为普通相册展示，并提供筛选与时间线", async ({ page }) => {
		await page.goto("/moments/", { waitUntil: "networkidle" });
		const sourceMomentPhoto = page.locator(".moment-card__gallery img").first();
		test.skip(
			(await sourceMomentPhoto.count()) === 0,
			"当前没有可验证的公开 Moments 图片",
		);
		const momentAlt = await sourceMomentPhoto.getAttribute("alt");
		const momentPublished = await sourceMomentPhoto
			.locator("xpath=ancestor::article")
			.locator("time")
			.getAttribute("datetime");
		const momentDate = momentPublished?.slice(0, 10).replaceAll("-", ".");

		await page.goto("/albums/", { waitUntil: "networkidle" });

		const lifeCard = page.locator(".album-card").filter({
			has: page.getByRole("heading", { name: "生活照片" }),
		});
		await expect(page.locator(".album-card").first()).toContainText("生活照片");
		await expect(lifeCard).toBeVisible();
		await lifeCard.getByRole("link").click();

		await expect(page).toHaveURL(/\/albums\/life\/$/);
		await expect(page.getByRole("heading", { name: "生活照片" })).toBeVisible();
		await expect(page.locator(".album-gallery__item").first()).toBeVisible();
		await expect(page.locator(".album-gallery__toolbar")).toBeVisible();
		await expect(page.locator(".album-gallery__meta").first()).toBeVisible();
		const momentPhoto = page
			.locator(".album-gallery__item")
			.filter({ has: page.getByAltText(momentAlt ?? "", { exact: true }) });
		await expect(momentPhoto).toHaveCount(1);
		await expect(momentPhoto.locator(".album-gallery__date")).toHaveText(
			momentDate ?? "",
		);

		const toolbarBox = await page
			.locator(".album-gallery__toolbar")
			.boundingBox();
		const galleryBox = await page.locator(".album-gallery").boundingBox();
		expect(toolbarBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(
			galleryBox?.y ?? 0,
		);

		const photoCount = await page.locator(".album-gallery__item").count();
		const timeline = page.getByRole("button", { name: "时间线" });
		await timeline.click();
		await expect(timeline).toHaveAttribute("aria-pressed", "true");
		await expect(page.locator(".album-gallery__timeline")).toBeVisible();
		await expect(page.locator(".album-gallery__month").first()).toBeVisible();
		await expect(page.locator(".album-gallery__month-label").first()).toHaveText(
			/2026/,
		);
		await expect(page.locator(".album-gallery__item")).toHaveCount(photoCount);
		await timeline.click();
		await expect(timeline).toHaveAttribute("aria-pressed", "false");
		await expect(page.locator(".album-gallery__timeline")).toBeHidden();
	});
});

test.describe("受保护相册", () => {
	test("提供完整的密码输入与解锁反馈", async ({ page }) => {
		// The gate renders before its media; waiting for network idle would make
		// this test depend on picsum.photos being reachable and fast.
		await page.goto("/albums/EncryptedExample/", {
			waitUntil: "domcontentloaded",
		});

		const input = page.getByRole("textbox", { name: "密码" });
		const submit = page.getByRole("button", { name: "解锁相册" });
		const visibility = page.getByRole("button", { name: "显示密码" });

		await expect(
			page.getByRole("heading", { name: "这是一个受保护相册" }),
		).toBeVisible();
		await expect(page.getByText("Six digits", { exact: true })).toBeVisible();
		await expect(input).toHaveAttribute("type", "password");
		await expect(input).toHaveAttribute("autocomplete", "current-password");

		await visibility.click();
		await expect(input).toHaveAttribute("type", "text");
		await expect(
			page.getByRole("button", { name: "隐藏密码" }),
		).toBeVisible();

		await submit.click();
		await expect(
			page.getByText("请输入密码", { exact: true }),
		).toBeVisible();
		await expect(input).toHaveAttribute("aria-invalid", "true");

		await input.fill("000000");
		await expect(
			page.getByText("请输入密码", { exact: true }),
		).toBeHidden();
		await submit.click();
		await expect(
			page.getByText("密码无法解锁这个相册", {
				exact: true,
			}),
		).toBeVisible();

		await input.fill("123456");
		await submit.click();
		await expect(page.locator(".album-gallery__item")).toHaveCount(2);
		await expect(page.locator(".album-gallery")).toHaveClass(
			/album-gallery--masonry/,
		);
		await expect(page.locator(".album-gallery")).not.toHaveClass(
			/album-gallery--grid/,
		);
		const portrait = page.getByAltText("A protected vertical photograph");
		const landscape = page.getByAltText("A protected garden landscape");
		await expect(
			page.locator(".album-gallery__item img").first(),
		).toHaveAttribute("alt", "A protected vertical photograph");
		await expect
			.poll(async () => {
				const portraitBox = await portrait.boundingBox();
				const landscapeBox = await landscape.boundingBox();
				if (!portraitBox || !landscapeBox) return false;
				const naturalDirections = await page.evaluate(() => {
					const portraitImage = document.querySelector(
						'img[alt="A protected vertical photograph"]',
					) as HTMLImageElement | null;
					const landscapeImage = document.querySelector(
						'img[alt="A protected garden landscape"]',
					) as HTMLImageElement | null;
					return Boolean(
						portraitImage &&
							landscapeImage &&
							portraitImage.naturalHeight > portraitImage.naturalWidth &&
							landscapeImage.naturalWidth > landscapeImage.naturalHeight,
					);
				});
				return (
					naturalDirections &&
					portraitBox.height > portraitBox.width &&
					landscapeBox.width > landscapeBox.height &&
					portraitBox.x <= landscapeBox.x
				);
			})
			.toBe(true);
		await expect(page.locator(".password-gate")).toBeHidden();
		await expect
			.poll(() =>
				page.locator(".album-detail__gallery").evaluate((element) => {
					const style = getComputedStyle(element);
					return (
						style.backgroundColor !== "rgba(0, 0, 0, 0)" &&
						style.padding !== "0px"
					);
				}),
			)
			.toBe(true);
	});
});
