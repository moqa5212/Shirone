import type { PageMeta } from "./pageMeta.ts";

export interface AlbumLifeConfig {
	enable: boolean;
	title: string;
	description: string;
	includeCategories: string[];
	includeTags: string[];
	excludeCategories: string[];
	excludeEncrypted: boolean;
}

export interface AlbumsConfig extends PageMeta {
	life: AlbumLifeConfig;
}
