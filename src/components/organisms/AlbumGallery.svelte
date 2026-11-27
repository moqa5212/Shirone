<script lang="ts">
import Chips from "@components/atoms/action/Chips.svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import { openFancyboxGallery } from "@utils/fancybox-handler";
import { createGregorianDateFormatter } from "@utils/locale-utils";
import { url } from "@utils/url-utils";
import { siteConfig } from "@/config/siteConfig";
import type { AlbumLayout, AlbumPhoto } from "@/types/album";

let {
	photos = [] as AlbumPhoto[],
	layout = "masonry" as AlbumLayout,
	columns = 3,
}: {
	photos?: AlbumPhoto[];
	layout?: AlbumLayout;
	columns?: 2 | 3 | 4;
} = $props();

let measuredRatios = $state<Record<string, number>>({});
let selectedFilter = $state("");
let view = $state<"grid" | "timeline" | "random">("grid");
let randomOrder = $state<string[]>([]);
type ChipItem = { value: string; label: string; leadingIcon?: string };
type TimelineGroup = { key: string; label: string; photos: AlbumPhoto[] };

const filterItems = $derived.by(() => {
	const locations = [
		...new Set(
			photos
				.map((photo) => photo.location?.trim())
				.filter((location): location is string => Boolean(location)),
		),
	];
	const tags = [...new Set(photos.flatMap((photo) => photo.tags))];
	const items: ChipItem[] = [
		{ value: "all", label: i18n(I18nKey.albumsAllPhotos) },
		...locations.slice(0, 6).map((location) => ({
			value: `location:${location}`,
			label: location,
			leadingIcon: "material-symbols:location-on-outline-rounded",
		})),
		...tags.slice(0, 8).map((tag) => ({
			value: `tag:${tag}`,
			label: tag,
			leadingIcon: "material-symbols:sell-outline-rounded",
		})),
	];
	return items;
});

const viewItems: ChipItem[] = [
	{
		value: "timeline",
		label: i18n(I18nKey.albumsTimeline),
		leadingIcon: "material-symbols:timeline-rounded",
	},
	{
		value: "random",
		label: i18n(I18nKey.albumsRandom),
		leadingIcon: "material-symbols:casino-outline-rounded",
	},
];

function filterPhotos(source: AlbumPhoto[], filter: string): AlbumPhoto[] {
	if (filter.startsWith("location:")) {
		const location = filter.slice("location:".length);
		return source.filter((photo) => photo.location === location);
	}
	if (filter.startsWith("tag:")) {
		const tag = filter.slice("tag:".length);
		return source.filter((photo) => photo.tags.includes(tag));
	}
	return source;
}

const filteredPhotos = $derived(filterPhotos(photos, selectedFilter));

function photoRatio(photo: AlbumPhoto): number | undefined {
	if (photo.width && photo.height) return photo.width / photo.height;
	return measuredRatios[photo.id];
}

function orientationPriority(photo: AlbumPhoto): number {
	// Only authoritative metadata may affect ordering; measured image ratios arrive
	// asynchronously and must not reshuffle an already rendered masonry grid.
	const value =
		photo.width && photo.height ? photo.width / photo.height : undefined;
	if (value === undefined || value === 1) return 1;
	return value < 1 ? 0 : 2;
}

const timelineGroups = $derived.by<TimelineGroup[]>(() => {
	const groups = new Map<string, AlbumPhoto[]>();
	for (const photo of filteredPhotos) {
		const key = photo.date?.slice(0, 7) || "";
		const bucket = groups.get(key);
		if (bucket) bucket.push(photo);
		else groups.set(key, [photo]);
	}
	const formatter = createGregorianDateFormatter(
		(siteConfig.lang || "en").replace("_", "-"),
		{ year: "numeric", month: "long", timeZone: "UTC" },
	);
	return [...groups.entries()]
		.sort((a, b) => b[0].localeCompare(a[0]))
		.map(([key, groupPhotos]) => ({
			key: key || "undated",
			label: key
				? formatter.format(new Date(`${key}-01T00:00:00Z`))
				: i18n(I18nKey.albumsUndated),
			photos: groupPhotos,
		}));
});

const visiblePhotos = $derived.by(() => {
	if (view === "random") {
		const order = new Map(randomOrder.map((id, index) => [id, index]));
		return [...filteredPhotos].sort(
			(a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
		);
	}
	if (view === "timeline")
		return timelineGroups.flatMap((group) => group.photos);
	if (layout !== "masonry") return filteredPhotos;
	return filteredPhotos
		.map((photo, index) => ({ photo, index }))
		.sort(
			(a, b) =>
				orientationPriority(a.photo) - orientationPriority(b.photo) ||
				a.index - b.index,
		)
		.map(({ photo }) => photo);
});

const photoPositions = $derived.by(
	() => new Map(visiblePhotos.map((photo, index) => [photo.id, index])),
);

function rememberNaturalRatio(photo: AlbumPhoto, event: Event) {
	if (photo.width && photo.height) return;
	const image = event.currentTarget as HTMLImageElement;
	if (!image.naturalWidth || !image.naturalHeight) return;
	measuredRatios[photo.id] = image.naturalWidth / image.naturalHeight;
}

function changeFilter(value: string) {
	if (value === "all" || value === selectedFilter) selectedFilter = "";
	else selectedFilter = value;
	if (view === "random") {
		randomOrder = shuffledIds(filterPhotos(photos, selectedFilter));
	}
}

function shuffledIds(source: AlbumPhoto[]): string[] {
	const ids = source.map((photo) => photo.id);
	for (let index = ids.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
	}
	return ids;
}

function shuffle() {
	randomOrder = shuffledIds(filteredPhotos);
}

function changeView(value: string) {
	if (value !== "timeline" && value !== "random") return;
	if (view === value) {
		view = "grid";
		return;
	}
	if (value === "random") shuffle();
	view = value;
}

function openPhoto(photo: AlbumPhoto) {
	const index = visiblePhotos.findIndex((item) => item.id === photo.id);
	void openFancyboxGallery(
		visiblePhotos.map((item) => ({
			src: item.src ? url(item.src) : "",
			caption: item.title || item.location || item.alt,
		})),
		index < 0 ? 0 : index,
	);
}

function ratio(photo: AlbumPhoto): string {
	const value = photoRatio(photo);
	return value === undefined ? "4 / 3" : String(value);
}

function displayName(photo: AlbumPhoto): string {
	return photo.location || photo.title || photo.alt;
}

function displayDate(photo: AlbumPhoto): string {
	return photo.date?.replaceAll("-", ".") ?? "";
}
</script>

{#snippet photoItem(photo: AlbumPhoto)}
	{@const position = photoPositions.get(photo.id) ?? 0}
	<button
		type="button"
		class:album-gallery__item--with-meta={Boolean(displayName(photo) || displayDate(photo))}
		class="album-gallery__item"
		style={`--album-photo-ratio: ${ratio(photo)}`}
		aria-label={`${displayName(photo) || photo.alt}${displayDate(photo) ? ` ${displayDate(photo)}` : ""} — ${i18n(I18nKey.openImage)} ${position + 1}: ${photo.alt}`}
		onclick={() => openPhoto(photo)}
	>
		<img
			src={url(photo.thumbnail || photo.src)}
			alt={photo.alt}
			width={photo.width}
			height={photo.height}
			loading="lazy"
			decoding="async"
			referrerpolicy="no-referrer"
			onload={(event) => rememberNaturalRatio(photo, event)}
		/>
		{#if displayName(photo) || displayDate(photo)}
			<span class="album-gallery__meta">
				{#if displayName(photo)}
					<span class="album-gallery__name">{displayName(photo)}</span>
				{/if}
				{#if displayDate(photo)}
					<span class="album-gallery__date">{displayDate(photo)}</span>
				{/if}
			</span>
		{/if}
	</button>
{/snippet}

{#if photos.length > 0}
	<div class="album-gallery__toolbar">
		<div class="album-gallery__filters">
			<Chips
				items={filterItems}
				variant="filter"
				value={selectedFilter || "all"}
				onchange={changeFilter}
			/>
		</div>
		<div class="album-gallery__views">
			<Chips
				items={viewItems}
				variant="filter"
				value={view === "grid" ? "" : view}
				onchange={changeView}
			/>
		</div>
	</div>
{/if}

{#if visiblePhotos.length > 0}
	{#if view === "timeline"}
		<div class="album-gallery__timeline">
			{#each timelineGroups as group (group.key)}
				<section class="album-gallery__month" aria-label={group.label}>
					<h3 class="album-gallery__month-label">
						<span>{group.label}</span>
						<span class="album-gallery__month-count">
							{group.photos.length} {i18n(I18nKey.albumsPhotos)}
						</span>
					</h3>
					<div
						class="album-gallery album-gallery--{layout}"
						style={`--album-columns: ${columns}`}
						role="group"
						aria-label={group.label}
					>
						{#each group.photos as photo (photo.id)}
							{@render photoItem(photo)}
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{:else}
		<div
			class="album-gallery album-gallery--{layout}"
			style={`--album-columns: ${columns}`}
			role="group"
			aria-label={i18n(I18nKey.imageViewer)}
		>
			{#each visiblePhotos as photo (photo.id)}
				{@render photoItem(photo)}
			{/each}
		</div>
	{/if}
{:else}
	<div class="album-gallery__empty">
		<Icon icon="material-symbols:photo-library-outline-rounded" aria-hidden="true" />
		<span>{i18n(I18nKey.noData)}</span>
	</div>
{/if}

<style lang="stylus">
.album-gallery
	--album-gap: var(--m3e-space-3, 0.75rem)
	width: 100%

	&__toolbar
		display: flex
		flex-wrap: wrap
		align-items: flex-start
		justify-content: space-between
		gap: var(--m3e-space-2, 0.5rem) var(--m3e-space-4, 1rem)
		margin-bottom: var(--m3e-space-4, 1rem)
		padding-bottom: var(--m3e-space-3, 0.75rem)
		border-bottom: 1px solid var(--outline-variant)

	&__filters, &__views
		display: flex
		flex-wrap: wrap
		gap: var(--m3e-space-2, 0.5rem)
		min-width: 0

	&__timeline
		display: grid
		gap: var(--m3e-space-6, 2rem)

	&__month
		display: grid
		gap: var(--m3e-space-3, 0.75rem)
		min-width: 0

	&__month-label
		display: flex
		flex-wrap: wrap
		align-items: baseline
		gap: var(--m3e-space-2, 0.5rem)
		margin: 0
		color: var(--on-surface)
		font: var(--m3e-type-title-medium)

	&__month-count
		color: var(--on-surface-variant)
		font: var(--m3e-type-label-medium)

	&--grid
		display: grid
		grid-template-columns: repeat(var(--album-columns), minmax(0, 1fr))
		gap: var(--album-gap)

	&--masonry
		direction: ltr
		column-width: 240px
		column-gap: var(--album-gap)
		column-fill: balance

	&__item
		position: relative
		display: block
		width: 100%
		margin: 0 0 var(--album-gap)
		padding: 0
		overflow: hidden
		border: 0
		border-radius: var(--shape-corner-m)
		background: var(--surface-container-high)
		color: inherit
		cursor: zoom-in
		break-inside: avoid
		font: inherit
		text-align: start
		isolation: isolate
		&:focus-visible
			outline: 2px solid var(--primary)
			outline-offset: 2px
		&--with-meta::after
			position: absolute
			inset: 60% 0 0
			z-index: 1
			background: linear-gradient(to top, rgb(0 0 0 / 0.82), rgb(0 0 0 / 0.34) 52%, transparent)
			content: ""
			pointer-events: none
		> img
			display: block
			width: 100%
			max-width: 100%
			aspect-ratio: var(--album-photo-ratio)
			object-fit: cover
			transition: transform var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate), filter var(--m3e-duration-medium) var(--m3e-easing-standard)
		.album-gallery--masonry & > img
			aspect-ratio: auto
			object-fit: cover

	&__meta
		position: absolute
		left: 0.75rem
		bottom: 0.75rem
		z-index: 2
		display: flex
		flex-direction: column
		gap: 0.125rem
		max-width: calc(100% - 1.5rem)
		color: #fff
		text-shadow: 0 1px 8px rgb(0 0 0 / 0.75)
		pointer-events: none

	&__name
		overflow: hidden
		font: var(--m3e-type-label-large)
		font-weight: 700
		line-height: 1.25
		text-overflow: ellipsis
		white-space: nowrap

	&__date
		color: rgb(255 255 255 / 0.76)
		font: var(--m3e-type-label-small)
		line-height: 1.2

	&__item:hover > img
		transform: scale(1.025)
		filter: brightness(0.92)

	&__empty
		display: grid
		place-items: center
		gap: 0.5rem
		min-height: 12rem
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-medium)
		> :global(svg)
			width: 2rem
			height: 2rem

@media (max-width: 47.99rem)
	.album-gallery--masonry
		column-width: 180px

@media (max-width: 29.99rem)
	.album-gallery--masonry
		column-width: 140px
	.album-gallery--grid
		grid-template-columns: repeat(2, minmax(0, 1fr))

:global(html.motion-reduced) .album-gallery__item > img
	transition: none

@media (prefers-reduced-motion: reduce)
	.album-gallery__item > img
		transition: none
</style>
