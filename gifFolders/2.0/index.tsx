/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import * as DataStore from "@api/DataStore";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { HeadingSecondary, HeadingTertiary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import definePlugin from "@utils/types";
import type { RenderModalProps } from "@vencord/discord-types";
import { findByPropsLazy } from "@webpack";
import { createRoot, Modal, openModal, showToast, TextInput, useEffect, useMemo, UserSettingsActionCreators, useState } from "@webpack/common";

const STORE_KEY = "GifFolders_favoriteFolders_v2";
const MANAGER_SIZE_STORE_KEY = "GifFolders_managerWindowSize";
const EXPORT_VERSION = 2;
const ALL_FOLDER_ID = "all";
const UNSORTED_FOLDER_ID = "unsorted";
const MANAGER_SIZE_OPTIONS = ["small", "large", "fullscreen"] as const;
const UserSettingsDelay = findByPropsLazy("INFREQUENT_USER_ACTION");

interface SearchBarComponentProps {
    ref?: React.RefObject<any>;
    autoFocus: boolean;
    size: string;
    onChange: (query: string) => void;
    onClear: () => void;
    query: string;
    placeholder: string;
    className?: string;
}

type SearchBarComponent = React.FC<SearchBarComponentProps>;
type ManagerSize = typeof MANAGER_SIZE_OPTIONS[number];
type PreviewKind = "image" | "video";

interface PreviewCandidate {
    kind: PreviewKind;
    url: string;
}

interface Gif {
    alt?: string;
    format?: number;
    gifSrc?: string;
    gif_src?: string;
    width?: number;
    height?: number;
    image?: string;
    media?: unknown;
    media_formats?: unknown;
    name?: string;
    order?: number;
    original?: string;
    preview?: string;
    preview_url?: string;
    proxy_url?: string;
    proxyURL?: string;
    proxyUrl?: string;
    src?: string;
    thumbnail?: string;
    thumbnail_url?: string;
    thumbnailUrl?: string;
    title?: string;
    url?: string;
    [key: string]: unknown;
}

interface Instance {
    dead?: boolean;
    state: {
        resultType?: string;
    };
    props: {
        favCopy: Gif[];
        favorites: Gif[];
    };
    forceUpdate: () => void;
}

interface GifFolder {
    id: string;
    name: string;
    createdAt: number;
}

interface FolderStore {
    folders: GifFolder[];
    assignments: Record<string, string[]>;
}

interface FolderStoreExport {
    plugin: "GifFolders";
    version: number;
    exportedAt: string;
    store: FolderStore;
    favoriteGifs: FavoriteGifsSettings;
}

interface FavoriteGifSettingsEntry {
    order?: number;
    [key: string]: unknown;
}

interface FavoriteGifsSettings {
    gifs?: Record<string, FavoriteGifSettingsEntry>;
}

interface GifFoldersImport {
    store: FolderStore;
    favoriteGifs: Record<string, FavoriteGifSettingsEntry>;
}

const runtime = {
    instance: null as Instance | null,
    store: null as FolderStore | null,
    activeFolderId: ALL_FOLDER_ID,
    query: ""
};

let storePromise: Promise<FolderStore> | null = null;
let storeWritePromise: Promise<void> = Promise.resolve();
let fallbackObserver: MutationObserver | null = null;
let fallbackScanTimeout: number | null = null;
let fallbackRoot: ReturnType<typeof createRoot> | null = null;
let fallbackHost: HTMLElement | null = null;
let nativeHeaderPatchActive = false;
const fallbackDisplayValues = new Map<HTMLElement, string>();

type SupportedLocale = "en" | "fr";

const TRANSLATIONS = {
    en: {
        all: "All",
        backup: "Backup",
        cancel: "Cancel",
        clearFolders: "Clear folders",
        close: "Close",
        create: "Create",
        createFolderHint: "Create a folder to start.",
        delete: "Delete",
        deleteFolderConfirm: "Delete this folder? GIFs will stay in your favorites.",
        emptyFolderName: "Folder name is empty.",
        export: "Export",
        exportSuccess: "GIF configuration exported.",
        favoriteSearchPlaceholder: "Search favorites",
        folder: "Folder",
        folderExists: "This folder already exists.",
        folderNamePlaceholder: "Folder name",
        foldersHeading: "Folders",
        import: "Import",
        importFavoritesError: "Folders imported, but favorite GIFs could not be added.",
        importFavoritesSuccess(count: number) {
            return `${count} missing favorite ${count === 1 ? "GIF was" : "GIFs were"} added.`;
        },
        importInvalid: "Invalid import file.",
        importSuccess: "GIF configuration imported.",
        loadError: "Could not load GIF folders.",
        manageButton: "Organize",
        managerTitle: "Organize favorite GIFs",
        newFolderPlaceholder: "New folder",
        noFavoritesFound: "No favorites found.",
        noFolders: "No folders.",
        pluginDescription: "Organizes native favorite GIFs into local folders in the GIF picker.",
        previewUnavailable: "Preview unavailable",
        rename: "Rename",
        save: "Save",
        saveError: "Could not save GIF folders.",
        searchPlaceholder: "Search",
        syncExports: "Sync exports",
        syncExportsSuccess: "GIF exports synchronized.",
        sizeFullscreen: "Almost fullscreen",
        sizeLabel: "Window size",
        sizeLarge: "Large",
        sizeSmall: "Small",
        unsorted: "Unsorted",
        untitledFolder: "Untitled",
        favoritesCount(count: number) {
            return `${count} ${count === 1 ? "favorite" : "favorites"}`;
        },
        foldersCount(count: number) {
            return `${count} ${count === 1 ? "folder" : "folders"}`;
        },
        visibleFavoritesCount(visible: number, total: number) {
            return `${visible} / ${total} favorites`;
        }
    },
    fr: {
        all: "Tous",
        backup: "Sauvegarde",
        cancel: "Annuler",
        clearFolders: "Retirer dossiers",
        close: "Fermer",
        create: "Creer",
        createFolderHint: "Cree un dossier pour commencer.",
        delete: "Supprimer",
        deleteFolderConfirm: "Supprimer ce dossier ? Les GIF restent dans tes favoris.",
        emptyFolderName: "Le nom du dossier est vide.",
        export: "Exporter",
        exportSuccess: "Configuration GIF exportee.",
        favoriteSearchPlaceholder: "Rechercher dans les favoris",
        folder: "Dossier",
        folderExists: "Ce dossier existe deja.",
        folderNamePlaceholder: "Nom du dossier",
        foldersHeading: "Dossiers",
        import: "Importer",
        importFavoritesError: "Dossiers importes, mais les GIF favoris n'ont pas pu etre ajoutes.",
        importFavoritesSuccess(count: number) {
            return `${count} GIF favoris manquants ajoutes.`;
        },
        importInvalid: "Fichier d'import invalide.",
        importSuccess: "Configuration GIF importee.",
        loadError: "Impossible de charger les dossiers GIF.",
        manageButton: "Classer",
        managerTitle: "Classer les GIF favoris",
        newFolderPlaceholder: "Nouveau dossier",
        noFavoritesFound: "Aucun favori trouve.",
        noFolders: "Aucun dossier.",
        pluginDescription: "Range les GIF favoris natifs dans des dossiers locaux du picker GIF.",
        previewUnavailable: "Apercu indisponible",
        rename: "Renommer",
        save: "Valider",
        saveError: "Impossible de sauvegarder les dossiers GIF.",
        searchPlaceholder: "Rechercher",
        syncExports: "Sync exports",
        syncExportsSuccess: "Exports GIF synchronises.",
        sizeFullscreen: "Presque plein ecran",
        sizeLabel: "Taille de la fenetre",
        sizeLarge: "Grande",
        sizeSmall: "Petite",
        unsorted: "Non ranges",
        untitledFolder: "Sans nom",
        favoritesCount(count: number) {
            return `${count} favoris`;
        },
        foldersCount(count: number) {
            return `${count} dossiers`;
        },
        visibleFavoritesCount(visible: number, total: number) {
            return `${visible} / ${total} favoris`;
        }
    }
};

function getLocale(): SupportedLocale {
    const documentLocale = typeof document !== "undefined"
        ? document.documentElement?.lang
        : undefined;
    const navigatorLocales = typeof navigator !== "undefined"
        ? [...(navigator.languages ?? []), navigator.language]
        : [];
    const candidates = [
        documentLocale,
        ...navigatorLocales
    ].filter(Boolean);

    return candidates.some(locale => locale?.toLowerCase().startsWith("fr")) ? "fr" : "en";
}

function getText() {
    return TRANSLATIONS[getLocale()];
}

function normalizeManagerSize(value: unknown): ManagerSize {
    return MANAGER_SIZE_OPTIONS.includes(value as ManagerSize) ? value as ManagerSize : "large";
}

function loadManagerSize() {
    try {
        return normalizeManagerSize(window.localStorage.getItem(MANAGER_SIZE_STORE_KEY));
    } catch {
        return "large";
    }
}

function saveManagerSize(size: ManagerSize) {
    try {
        window.localStorage.setItem(MANAGER_SIZE_STORE_KEY, size);
    } catch { }
}

function getManagerSizeLabel(text: ReturnType<typeof getText>, size: ManagerSize) {
    switch (size) {
        case "small":
            return text.sizeSmall;
        case "fullscreen":
            return text.sizeFullscreen;
        case "large":
        default:
            return text.sizeLarge;
    }
}

const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

function emptyStore(): FolderStore {
    return {
        folders: [],
        assignments: {}
    };
}

function normalizeStore(value: FolderStore | undefined): FolderStore {
    if (!value || typeof value !== "object") return emptyStore();

    const seenFolders = new Set<string>();
    const folders = Array.isArray(value.folders)
        ? value.folders
            .filter(folder => folder?.id)
            .map(folder => ({
                id: String(folder.id),
                name: String(folder.name || getText().untitledFolder),
                createdAt: Number(folder.createdAt || Date.now())
            }))
            .filter(folder => {
                if (seenFolders.has(folder.id)) return false;
                seenFolders.add(folder.id);
                return true;
            })
        : [];

    const folderIds = new Set(folders.map(folder => folder.id));
    const assignments: Record<string, string[]> = {};

    if (value.assignments && typeof value.assignments === "object") {
        for (const [gifKey, assignedFolders] of Object.entries(value.assignments)) {
            if (!Array.isArray(assignedFolders)) continue;

            const validFolders = [...new Set(assignedFolders.map(String))]
                .filter(folderId => folderIds.has(folderId));

            if (validFolders.length > 0) assignments[gifKey] = validFolders;
        }
    }

    return { folders, assignments };
}

async function loadStore() {
    storePromise ??= DataStore.get<FolderStore>(STORE_KEY).then(normalizeStore);
    return storePromise;
}

async function saveStore(store: FolderStore) {
    const normalizedStore = normalizeStore(store);
    runtime.store = normalizedStore;
    storePromise = Promise.resolve(normalizedStore);

    // Several rapid clicks can otherwise finish their DataStore writes out of
    // order and resurrect an older folder assignment.
    storeWritePromise = storeWritePromise
        .catch(() => undefined)
        .then(() => DataStore.set(STORE_KEY, normalizedStore));
    await storeWritePromise;
}

function isFolderFilterAvailable(store: FolderStore, folderId: string) {
    return folderId === ALL_FOLDER_ID
        || folderId === UNSORTED_FOLDER_ID
        || store.folders.some(folder => folder.id === folderId);
}

function getFolderFilterLabel(store: FolderStore, folderId: string) {
    const text = getText();

    if (folderId === ALL_FOLDER_ID) return text.all;
    if (folderId === UNSORTED_FOLDER_ID) return text.unsorted;

    return store.folders.find(folder => folder.id === folderId)?.name ?? text.folder;
}

function normalizeFavoriteGifs(value: unknown) {
    if (!value || typeof value !== "object") return {};

    const record = value as Record<string, unknown>;
    const gifs = record.gifs && typeof record.gifs === "object"
        ? record.gifs as Record<string, unknown>
        : record;
    const normalized: Record<string, FavoriteGifSettingsEntry> = {};

    for (const [url, entry] of Object.entries(gifs)) {
        if (!isImportableGifUrl(url) || !entry || typeof entry !== "object" || Array.isArray(entry)) continue;
        normalized[url] = { ...(entry as FavoriteGifSettingsEntry) };
    }

    return normalized;
}

function normalizeImport(value: unknown): GifFoldersImport | null {
    if (!value || typeof value !== "object") return null;

    const record = value as Record<string, unknown>;
    const candidate = "store" in record ? record.store : value;
    if (!candidate || typeof candidate !== "object") return null;

    const candidateRecord = candidate as Record<string, unknown>;
    const hasAssignments = Boolean(candidateRecord.assignments && typeof candidateRecord.assignments === "object");
    if (!Array.isArray(candidateRecord.folders) && !hasAssignments) return null;

    const store = normalizeStore(candidate as FolderStore);
    const exportedFavorites = normalizeFavoriteGifs(record.favoriteGifs);

    // Version 1 exports did not contain native favorites. Assignment keys are
    // still enough to restore every GIF that was placed in a folder.
    for (const url of getImportedGifUrls(store)) {
        exportedFavorites[url] ??= {};
    }

    return { store, favoriteGifs: exportedFavorites };
}

async function exportStore(store: FolderStore) {
    await UserSettingsActionCreators.FrecencyUserSettingsActionCreators.loadIfNecessary?.();

    downloadExport(createExportPayload(store, { ...(getCurrentFavoriteGifs() ?? {}) }), "gif-folders");
    showToast(getText().exportSuccess, "success");
}

function downloadExport(payload: FolderStoreExport, filePrefix: string) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${filePrefix}-${new Date().toISOString().slice(0, 10)}.json`;
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function createExportPayload(store: FolderStore, favoriteGifs: Record<string, FavoriteGifSettingsEntry>): FolderStoreExport {
    return {
        plugin: "GifFolders",
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        store: normalizeStore(store),
        favoriteGifs: {
            gifs: favoriteGifs
        }
    };
}

function isImportableGifUrl(value: string) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch {
        return false;
    }
}

function getImportedGifUrls(store: FolderStore) {
    return Object.keys(store.assignments)
        .filter(isImportableGifUrl)
        .filter((url, index, urls) => urls.indexOf(url) === index);
}

function getFavoriteGifOrder(entry: FavoriteGifSettingsEntry | undefined) {
    return typeof entry?.order === "number" && Number.isFinite(entry.order)
        ? entry.order
        : 0;
}

function getNextFavoriteGifOrder(gifs: Record<string, FavoriteGifSettingsEntry>) {
    return Math.max(0, ...Object.values(gifs).map(getFavoriteGifOrder)) + 1;
}

function getCurrentFavoriteGifs() {
    return UserSettingsActionCreators.FrecencyUserSettingsActionCreators
        .getCurrentValue()
        ?.favoriteGifs
        ?.gifs as Record<string, FavoriteGifSettingsEntry> | undefined;
}

async function importFavoriteGifs(importedGifs: Record<string, FavoriteGifSettingsEntry>) {
    const importedUrls = Object.keys(importedGifs);
    if (importedUrls.length === 0) return 0;

    await UserSettingsActionCreators.FrecencyUserSettingsActionCreators.loadIfNecessary?.();

    const currentGifs = getCurrentFavoriteGifs() ?? {};
    const missingUrls = importedUrls.filter(url => !Object.hasOwn(currentGifs, url));
    if (missingUrls.length === 0) return 0;

    await UserSettingsActionCreators.FrecencyUserSettingsActionCreators.updateAsync(
        "favoriteGifs",
        (favoriteGifs: FavoriteGifsSettings) => {
            favoriteGifs.gifs ??= {};
            let nextOrder = getNextFavoriteGifOrder(favoriteGifs.gifs);

            for (const url of missingUrls) {
                if (Object.hasOwn(favoriteGifs.gifs, url)) continue;
                const importedEntry = importedGifs[url];
                favoriteGifs.gifs[url] = {
                    ...importedEntry,
                    order: nextOrder++
                };
            }
        },
        UserSettingsDelay.INFREQUENT_USER_ACTION
    );

    return missingUrls.length;
}

function importStore(onImport: (imported: GifFoldersImport) => void) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";

    input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        try {
            const imported = normalizeImport(JSON.parse(await file.text()));
            if (!imported) throw new Error("Invalid GifFolders export");

            onImport(imported);
            showToast(getText().importSuccess, "success");
        } catch {
            showToast(getText().importInvalid, "failure");
        }
    };

    input.click();
}

function selectExportFiles() {
    return new Promise<File[]>((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json,.json";
        input.multiple = true;

        input.onchange = () => {
            const files = [...(input.files ?? [])];
            if (files.length !== 2) {
                reject(new Error("Expected exactly two GifFolders export files"));
                return;
            }

            resolve(files);
        };

        input.click();
    });
}

async function readExportFile(file: File) {
    const imported = normalizeImport(JSON.parse(await file.text()));
    if (!imported) throw new Error("Invalid GifFolders export");
    return imported;
}

function getFolderMergeKey(folder: GifFolder) {
    return folder.name.trim().toLowerCase() || folder.id;
}

function mergeImportedExports(first: GifFoldersImport, second: GifFoldersImport): GifFoldersImport {
    const folders: GifFolder[] = [];
    const folderIdMap = new Map<string, string>();
    const folderKeyMap = new Map<string, string>();

    function addFolder(folder: GifFolder) {
        const key = getFolderMergeKey(folder);
        const existingId = folderKeyMap.get(key);
        if (existingId) {
            folderIdMap.set(folder.id, existingId);
            return;
        }

        let { id } = folder;
        if (folders.some(existingFolder => existingFolder.id === id)) {
            id = createId();
        }

        folderIdMap.set(folder.id, id);
        folderKeyMap.set(key, id);
        folders.push({ ...folder, id });
    }

    first.store.folders.forEach(addFolder);
    second.store.folders.forEach(addFolder);

    const assignments: Record<string, string[]> = {};

    function addAssignments(store: FolderStore) {
        for (const [gifKey, folderIds] of Object.entries(store.assignments)) {
            const nextFolderIds = folderIds
                .map(folderId => folderIdMap.get(folderId))
                .filter(Boolean) as string[];

            if (nextFolderIds.length === 0) continue;

            assignments[gifKey] = [...new Set([
                ...(assignments[gifKey] ?? []),
                ...nextFolderIds
            ])];
        }
    }

    addAssignments(first.store);
    addAssignments(second.store);

    const favoriteGifs = {
        ...first.favoriteGifs,
        ...second.favoriteGifs
    };
    let nextOrder = getNextFavoriteGifOrder(favoriteGifs);

    for (const url of getImportedGifUrls({ folders, assignments })) {
        favoriteGifs[url] ??= { order: nextOrder++ };
    }

    return {
        store: normalizeStore({ folders, assignments }),
        favoriteGifs
    };
}

async function syncExportFiles() {
    const [firstFile, secondFile] = await selectExportFiles();
    const [first, second] = await Promise.all([
        readExportFile(firstFile),
        readExportFile(secondFile)
    ]);
    const merged = mergeImportedExports(first, second);

    downloadExport(createExportPayload(merged.store, merged.favoriteGifs), "gif-folders-synced");
    showToast(getText().syncExportsSuccess, "success");
}

function getGifKey(gif: Gif) {
    return firstUrl(
        gif.url,
        gif.src,
        gif.gifSrc,
        gif.gif_src,
        gif.media_formats,
        gif.media,
        gif.preview,
        gif.image,
        gif
    ) ?? "";
}

function getGifImages(gif: Gif) {
    return collectUrls([
        gif.src,
        gif.gifSrc,
        gif.gif_src,
        gif.preview,
        gif.preview_url,
        gif.proxy_url,
        gif.proxyURL,
        gif.proxyUrl,
        gif.thumbnail,
        gif.thumbnail_url,
        gif.thumbnailUrl,
        gif.image,
        gif.original,
        gif.media_formats,
        gif.media,
        gif.url,
        gif
    ])
        .flatMap(expandMediaUrlCandidates)
        .filter((url, index, urls) => urls.indexOf(url) === index);
}

function getGifPreviews(gif: Gif): PreviewCandidate[] {
    return getGifImages(gif)
        .map(url => {
            const kind = getPreviewKind(url);
            return kind ? { kind, url } : null;
        })
        .filter(Boolean) as PreviewCandidate[];
}

function firstUrl(...values: unknown[]): string | undefined {
    return collectUrls(values)[0];
}

function collectUrls(values: unknown[]) {
    const urls: string[] = [];
    const seen = new Set<unknown>();

    function visit(value: unknown) {
        if (!value || seen.has(value)) return;
        seen.add(value);

        if (typeof value === "string") {
            const trimmed = value.trim();
            if (!trimmed) return;

            const url = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
            if (/^(https?:|data:image\/|blob:)/.test(url)) urls.push(url);
            return;
        }

        if (Array.isArray(value)) {
            for (const item of value) visit(item);
            return;
        }

        if (typeof value !== "object") return;

        const record = value as Record<string, unknown>;
        const preferredKeys = [
            "src",
            "url",
            "gifSrc",
            "gif_src",
            "proxy_url",
            "proxyURL",
            "proxyUrl",
            "preview",
            "preview_url",
            "image",
            "thumbnail",
            "thumbnail_url",
            "thumbnailUrl",
            "original",
            "originalUrl",
            "href",
            "gif",
            "tinygif",
            "mediumgif",
            "nanogif",
            "webp",
            "mp4"
        ];

        for (const key of preferredKeys) {
            visit(record[key]);
        }

        for (const item of Object.values(record)) {
            visit(item);
        }
    }

    for (const value of values) {
        visit(value);
    }

    return [...new Set(urls)];
}

function expandMediaUrlCandidates(url: string) {
    const candidates = [url];

    try {
        const parsed = new URL(url);

        if (parsed.hostname.endsWith("tenor.com") && parsed.pathname.includes("/view/") && !parsed.pathname.endsWith(".gif")) {
            const candidate = new URL(parsed);
            candidate.pathname = `${candidate.pathname}.gif`;
            candidates.push(candidate.href);
        }

        if (parsed.pathname.includes("/attachments/")) {
            for (const host of ["cdn.discordapp.com", "media.discordapp.net"]) {
                const candidate = new URL(parsed);
                candidate.hostname = host;
                candidates.push(candidate.href);
            }

            if (parsed.hostname === "media.discordapp.net") {
                for (const format of ["gif", "webp"]) {
                    const candidate = new URL(parsed);
                    candidate.searchParams.set("format", format);
                    candidates.push(candidate.href);
                }
            }
        }
    } catch { }

    const direct = candidates.filter(isDirectMediaUrl);
    return direct.length ? direct : candidates;
}

function getPreviewKind(url: string): PreviewKind | undefined {
    if (isVideoUrl(url)) return "video";
    if (isDirectImageUrl(url)) return "image";
    return undefined;
}

function isDirectMediaUrl(url: string) {
    return Boolean(getPreviewKind(url));
}

function isVideoUrl(url: string) {
    try {
        const parsed = new URL(url);
        return /\.(mp4|webm|mov)(?:$|\?)/i.test(parsed.pathname)
            || parsed.searchParams.get("format") === "mp4"
            || parsed.searchParams.get("format") === "webm";
    } catch {
        return url.startsWith("blob:");
    }
}

function isDirectImageUrl(url: string) {
    try {
        const parsed = new URL(url);
        const format = parsed.searchParams.get("format");

        return /\.(gif|webp|png|jpe?g)(?:$|\?)/i.test(parsed.pathname)
            || format === "gif"
            || format === "webp"
            || format === "png"
            || format === "jpg"
            || format === "jpeg"
            || parsed.hostname === "media.tenor.com"
            || parsed.hostname === "cdn.discordapp.com"
            || parsed.hostname === "media.discordapp.net"
            || /^images-ext-\d+\.discordapp\.net$/.test(parsed.hostname)
            || parsed.hostname.includes("giphy.com");
    } catch {
        return url.startsWith("data:image/") || url.startsWith("blob:");
    }
}

function getKnownFavorites(instance: Instance) {
    return getOriginalFavorites(instance);
}

function getOriginalFavorites(instance: Instance) {
    const propFavorites =
        Array.isArray(instance.props.favCopy) && instance.props.favCopy.length > 0
            ? instance.props.favCopy
            : Array.isArray(instance.props.favorites)
                ? instance.props.favorites
                : [];

    return propFavorites;
}

function getManageableFavorites(instance: Instance) {
    return enrichFavorites(getOriginalFavorites(instance), getVisibleFavorites());
}

function enrichFavorites(favorites: Gif[], visibleFavorites: Gif[]) {
    return favorites.map(gif => {
        const visibleFavorite = findVisibleFavorite(gif, visibleFavorites);
        if (!visibleFavorite) return gif;

        const media = collectUrls([
            gif.media,
            gif.media_formats,
            gif.src,
            gif.preview,
            gif.image,
            visibleFavorite.media,
            visibleFavorite.src,
            visibleFavorite.url
        ]);

        return {
            ...gif,
            image: gif.image ?? visibleFavorite.src,
            media,
            preview: gif.preview ?? visibleFavorite.src,
            src: gif.src ?? visibleFavorite.src
        };
    });
}

function findVisibleFavorite(gif: Gif, visibleFavorites: Gif[]) {
    const gifKey = getGifKey(gif);
    const gifUrls = new Set(getGifImages(gif));
    const gifLabel = getComparableGifLabel(gif);

    return visibleFavorites.find(visibleFavorite => {
        const visibleKey = getGifKey(visibleFavorite);
        if (visibleKey && (visibleKey === gifKey || gifUrls.has(visibleKey))) return true;

        const visibleLabel = getComparableGifLabel(visibleFavorite);
        return Boolean(gifLabel && visibleLabel && gifLabel === visibleLabel);
    });
}

function getVisibleFavorites(): Gif[] {
    const picker = document.querySelector("#gif-picker-tab-panel");
    if (!picker) return [];

    return [...picker.querySelectorAll<HTMLElement>("img, video, [style*='background-image']")]
        .map(element => {
            const urls = getElementMediaUrls(element);
            const src = urls[0];
            if (!src) return null;

            const labelElement = element.closest<HTMLElement>("[aria-label], [title], [role='button']") ?? element;
            const label = firstText(
                element.getAttribute("alt"),
                element.getAttribute("title"),
                labelElement.getAttribute("aria-label"),
                labelElement.getAttribute("title")
            );

            return {
                alt: label,
                media: urls,
                name: label,
                src,
                title: label,
                url: src
            } satisfies Gif;
        })
        .filter(Boolean) as Gif[];
}

function getElementMediaUrls(element: Element) {
    const values: unknown[] = [];

    if (element instanceof HTMLImageElement) {
        values.push(element.currentSrc, element.src, parseSrcSet(element.srcset));
    }

    if (element instanceof HTMLVideoElement) {
        values.push(element.currentSrc, element.src, element.poster);

        for (const source of element.querySelectorAll("source")) {
            values.push(source.getAttribute("src"), source.getAttribute("srcset"));
        }
    }

    if (element instanceof HTMLElement) {
        values.push(
            element.getAttribute("href"),
            element.dataset.href,
            element.dataset.src,
            element.dataset.url,
            extractCssUrls(element.style.backgroundImage)
        );

        try {
            values.push(extractCssUrls(getComputedStyle(element).backgroundImage));
        } catch { }
    }

    return collectUrls(values)
        .flatMap(expandMediaUrlCandidates)
        .filter((url, index, urls) => urls.indexOf(url) === index);
}

function parseSrcSet(srcset: string) {
    return srcset
        .split(",")
        .map(source => source.trim().split(/\s+/)[0])
        .filter(Boolean);
}

function extractCssUrls(backgroundImage: string) {
    const urls: string[] = [];
    const matcher = /url\((["']?)(.*?)\1\)/g;
    let match: RegExpExecArray | null;

    while ((match = matcher.exec(backgroundImage))) {
        urls.push(match[2]);
    }

    return urls;
}

function fallbackGifName(gif: Gif) {
    const gifKey = getGifKey(gif);
    const name = firstText(gif.name, gif.title, gif.alt);
    if (name) return name;

    try {
        const parsed = new URL(gifKey);
        const fileName = parsed.pathname.split("/").filter(Boolean).at(-1);
        return decodeURIComponent(fileName || parsed.hostname).replace(/\.(gif|webp|mp4)$/i, "");
    } catch {
        return "GIF";
    }
}

function getComparableGifLabel(gif: Gif) {
    return firstText(gif.name, gif.title, gif.alt)?.toLowerCase();
}

function firstText(...values: unknown[]) {
    for (const value of values) {
        if (typeof value !== "string") continue;

        const trimmed = value.trim();
        if (trimmed) return trimmed;
    }

    return undefined;
}

function getAssignedFolderIds(store: FolderStore, gif: Gif) {
    return store.assignments[getGifKey(gif)] ?? [];
}

function isGifInFolder(store: FolderStore, gif: Gif, folderId: string) {
    if (folderId === ALL_FOLDER_ID) return true;

    const assignedFolders = getAssignedFolderIds(store, gif);
    if (folderId === UNSORTED_FOLDER_ID) return assignedFolders.length === 0;

    return assignedFolders.includes(folderId);
}

function folderCount(store: FolderStore, favorites: Gif[], folderId: string) {
    return favorites.filter(gif => isGifInFolder(store, gif, folderId)).length;
}

function getSearchTarget(gif: Gif) {
    const gifKey = getGifKey(gif);

    try {
        const parsed = new URL(gifKey);
        return `${parsed.host} ${parsed.pathname.split("/").at(-1) ?? parsed.pathname}`.toLowerCase();
    } catch {
        return gifKey.toLowerCase();
    }
}

function filterFavorites(favorites: Gif[]) {
    const { store } = runtime;
    let result = favorites;

    if (store) {
        result = result.filter(gif => isGifInFolder(store, gif, runtime.activeFolderId));
    }

    const query = runtime.query.trim().toLowerCase();
    if (query) {
        result = result.filter(gif => getSearchTarget(gif).includes(query));
    }

    return result;
}

function scrollPickerToTop() {
    document
        .querySelector("#gif-picker-tab-panel")
        ?.querySelector('[class*="scrollerBase"]')
        ?.scrollTo(0, 0);
}

function refreshPicker() {
    applyDomFallbackFilter();
    const { instance } = runtime;
    if (!instance || instance.dead) return;

    instance.props.favorites = filterFavorites(getOriginalFavorites(instance));
    instance.forceUpdate();
}

function getCurrentFavoritesFromSettings(): Gif[] {
    return Object.entries(getCurrentFavoriteGifs() ?? {})
        .map(([url, entry]) => ({
            ...(entry as Gif),
            url,
            src: typeof (entry as Gif).src === "string" ? (entry as Gif).src : url
        }))
        .sort((a, b) => getFavoriteGifOrder(a) - getFavoriteGifOrder(b));
}

function findPickerInstanceFromDom(): Instance | null {
    const picker = document.querySelector<HTMLElement>("#gif-picker-tab-panel");
    if (!picker) return null;

    const candidates = [picker, ...picker.children];
    const visited = new Set<unknown>();

    for (const element of candidates) {
        const fiberKey = Object.keys(element).find(key => key.startsWith("__reactFiber$"));
        let fiber = fiberKey ? (element as any)[fiberKey] : null;

        while (fiber && !visited.has(fiber)) {
            visited.add(fiber);
            const stateNode = fiber.stateNode as Instance | undefined;

            if (
                stateNode
                && typeof stateNode.forceUpdate === "function"
                && stateNode.props
                && (Array.isArray(stateNode.props.favorites) || Array.isArray(stateNode.props.favCopy))
            ) {
                stateNode.props.favCopy ??= stateNode.props.favorites;
                stateNode.dead = false;
                return stateNode;
            }

            fiber = fiber.return;
        }
    }

    return null;
}

function applyDomFallbackFilter() {
    const instance = findPickerInstanceFromDom();
    if (instance) runtime.instance = instance;

    // Never hide Discord nodes directly. React recycles GIF/category elements,
    // so an inline display:none can leak into another folder or category and
    // blank the entire grid. Filtering is applied through the native instance.
    restoreDomFallbackFilter();
}

function restoreDomFallbackFilter() {
    for (const [container, display] of fallbackDisplayValues) {
        container.style.display = display;
    }
    fallbackDisplayValues.clear();
}

function scheduleFallbackScan() {
    if (fallbackScanTimeout !== null) return;

    fallbackScanTimeout = window.setTimeout(() => {
        fallbackScanTimeout = null;
        mountDomFallback();
        applyDomFallbackFilter();
    }, 100);
}

function mountDomFallback() {
    const picker = document.querySelector<HTMLElement>("#gif-picker-tab-panel");
    if (!picker) {
        unmountDomFallback();
        return;
    }

    const pickerText = picker.textContent?.toLocaleLowerCase() ?? "";
    const isFavoritesView = /(^|\s)(favorites|favoris)(\s|$)/i.test(pickerText);

    // Once the native header patch has executed, the fallback must stay
    // disabled. If that patch is unavailable for a Discord module variant,
    // only mount the fallback on the actual Favorites view.
    // Other GIF categories intentionally do not render the favorites header;
    // treating that as a patch failure would mount the fallback over Trending
    // or search results and hide their items with the active folder filter.
    if (nativeHeaderPatchActive || !isFavoritesView) {
        unmountDomFallback();
        restoreDomFallbackFilter();
        return;
    }

    if (picker.querySelector(".vc-gif-folders-picker-header:not(.vc-gif-folders-dom-fallback)")) {
        unmountDomFallback();
        return;
    }

    if (fallbackHost && picker.contains(fallbackHost)) return;

    unmountDomFallback();

    fallbackHost = document.createElement("div");
    fallbackHost.className = "vc-gif-folders-picker-header vc-gif-folders-dom-fallback";
    picker.prepend(fallbackHost);

    fallbackRoot = createRoot(fallbackHost);
    fallbackRoot.render(
        <ErrorBoundary noop>
            <GifFoldersDomFallback />
        </ErrorBoundary>
    );
}

function unmountDomFallback() {
    fallbackRoot?.unmount();
    fallbackRoot = null;
    fallbackHost?.remove();
    fallbackHost = null;
}

function startDomFallback() {
    stopDomFallback();

    if (!document.body) {
        document.addEventListener("DOMContentLoaded", startDomFallback, { once: true });
        return;
    }

    scheduleFallbackScan();

    fallbackObserver = new MutationObserver(scheduleFallbackScan);
    fallbackObserver.observe(document.body, { childList: true, subtree: true });
}

function stopDomFallback() {
    fallbackObserver?.disconnect();
    fallbackObserver = null;

    if (fallbackScanTimeout !== null) {
        window.clearTimeout(fallbackScanTimeout);
        fallbackScanTimeout = null;
    }

    unmountDomFallback();
    restoreDomFallbackFilter();
}

function openManagerModal(favorites: Gif[], store: FolderStore, onStoreChange?: (store: FolderStore) => void) {
    openModal(modalProps => (
        <ErrorBoundary noop>
            <GifFolderManagerModal
                favorites={favorites}
                initialStore={store}
                modalProps={modalProps}
                onStoreChange={nextStore => {
                    runtime.store = nextStore;
                    onStoreChange?.(nextStore);
                    refreshPicker();
                }}
            />
        </ErrorBoundary>
    ));
}

function GifFoldersDomFallback() {
    const text = getText();
    const [store, setStore] = useState(runtime.store ?? emptyStore());
    const [activeFolderId, setActiveFolderId] = useState(runtime.activeFolderId);
    const [favorites, setFavorites] = useState<Gif[]>([]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            await UserSettingsActionCreators.FrecencyUserSettingsActionCreators.loadIfNecessary?.();
            const [nextStore] = await Promise.all([loadStore()]);
            if (cancelled) return;

            runtime.store = nextStore;
            setStore(nextStore);
            setFavorites(getCurrentFavoritesFromSettings());
            window.setTimeout(refreshPicker, 0);
        }

        load().catch(() => showToast(getText().loadError, "failure"));

        const interval = window.setInterval(() => {
            if (!cancelled) setFavorites(getCurrentFavoritesFromSettings());
        }, 1500);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, []);

    function selectFolder(folderId: string) {
        runtime.activeFolderId = folderId;
        setActiveFolderId(folderId);
        scrollPickerToTop();
        refreshPicker();
    }

    return (
        <div className="vc-gif-folders-toolbar">
            <div className="vc-gif-folders-chip-row">
                <FolderChip
                    active={activeFolderId === ALL_FOLDER_ID}
                    count={favorites.length}
                    label={text.all}
                    onClick={() => selectFolder(ALL_FOLDER_ID)}
                />
                <FolderChip
                    active={activeFolderId === UNSORTED_FOLDER_ID}
                    count={folderCount(store, favorites, UNSORTED_FOLDER_ID)}
                    label={text.unsorted}
                    onClick={() => selectFolder(UNSORTED_FOLDER_ID)}
                />
                {store.folders.map(folder => (
                    <FolderChip
                        active={activeFolderId === folder.id}
                        count={folderCount(store, favorites, folder.id)}
                        key={folder.id}
                        label={folder.name}
                        onClick={() => selectFolder(folder.id)}
                    />
                ))}
            </div>

            <Button
                onClick={() => openManagerModal(favorites, store, nextStore => {
                    runtime.store = nextStore;
                    setStore(nextStore);
                    refreshPicker();
                })}
                size="small"
                variant="secondary"
            >
                {text.manageButton}
            </Button>
        </div>
    );
}

function GifFoldersHeader({ instance, SearchBarComponent }: { instance: Instance; SearchBarComponent: SearchBarComponent; }) {
    const text = getText();
    const [store, setStore] = useState(runtime.store ?? emptyStore());
    const [activeFolderId, setActiveFolderId] = useState(runtime.activeFolderId);
    const [query, setQuery] = useState(runtime.query);

    const favorites = getKnownFavorites(instance);

    useEffect(() => {
        let cancelled = false;

        instance.dead = false;
        runtime.instance = instance;
        loadStore().then(nextStore => {
            if (cancelled) return;

            runtime.store = nextStore;
            setStore(nextStore);
            refreshPicker();
        }).catch(() => showToast(getText().loadError, "failure"));

        return () => {
            cancelled = true;
            instance.dead = true;
            if (runtime.instance === instance) runtime.instance = null;
        };
    }, [instance]);

    function selectFolder(folderId: string) {
        runtime.activeFolderId = folderId;
        setActiveFolderId(folderId);
        scrollPickerToTop();
        refreshPicker();
    }

    function updateSearch(nextQuery: string) {
        runtime.query = nextQuery;
        setQuery(nextQuery);
        scrollPickerToTop();
        refreshPicker();
    }

    return (
        <div className="vc-gif-folders-picker-header">
            <SearchBarComponent
                autoFocus={true}
                className=""
                onChange={updateSearch}
                onClear={() => updateSearch("")}
                placeholder={text.favoriteSearchPlaceholder}
                query={query}
                size="md"
            />

            <div className="vc-gif-folders-toolbar">
                <div className="vc-gif-folders-chip-row">
                    <FolderChip
                        active={activeFolderId === ALL_FOLDER_ID}
                        count={favorites.length}
                        label={text.all}
                        onClick={() => selectFolder(ALL_FOLDER_ID)}
                    />
                    <FolderChip
                        active={activeFolderId === UNSORTED_FOLDER_ID}
                        count={folderCount(store, favorites, UNSORTED_FOLDER_ID)}
                        label={text.unsorted}
                        onClick={() => selectFolder(UNSORTED_FOLDER_ID)}
                    />
                    {store.folders.map(folder => (
                        <FolderChip
                            active={activeFolderId === folder.id}
                            count={folderCount(store, favorites, folder.id)}
                            key={folder.id}
                            label={folder.name}
                            onClick={() => selectFolder(folder.id)}
                        />
                    ))}
                </div>

                <Button
                    onClick={() => openManagerModal(getManageableFavorites(instance), store, setStore)}
                    size="small"
                    variant="secondary"
                >
                    {text.manageButton}
                </Button>
            </div>
        </div>
    );
}

function FolderChip({ active, count, label, onClick }: { active: boolean; count: number; label: string; onClick(): void; }) {
    return (
        <button
            aria-pressed={active}
            className={active ? "vc-gif-folders-chip active" : "vc-gif-folders-chip"}
            onClick={onClick}
            type="button"
        >
            <span>{label}</span>
            <small>{count}</small>
        </button>
    );
}

function ManagerFolderRow({
    active,
    children,
    count,
    label,
    onSelect
}: {
    active: boolean;
    children?: React.ReactNode;
    count: number;
    label: string;
    onSelect(): void;
}) {
    return (
        <div className={active ? "vc-gif-folders-folder-row active" : "vc-gif-folders-folder-row"}>
            <button
                aria-pressed={active}
                className="vc-gif-folders-folder-select"
                onClick={onSelect}
                title={label}
                type="button"
            >
                <span>{label}</span>
                <small>{count}</small>
            </button>

            {children ? <div className="vc-gif-folders-folder-actions">{children}</div> : null}
        </div>
    );
}

function GifFolderManagerModal({
    favorites,
    initialStore,
    modalProps,
    onStoreChange
}: {
    favorites: Gif[];
    initialStore: FolderStore;
    modalProps: RenderModalProps;
    onStoreChange(store: FolderStore): void;
}) {
    const text = getText();
    const [store, setStore] = useState(initialStore);
    const [activeManagerFolderId, setActiveManagerFolderId] = useState(
        isFolderFilterAvailable(initialStore, runtime.activeFolderId) ? runtime.activeFolderId : ALL_FOLDER_ID
    );
    const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
    const [editingFolderName, setEditingFolderName] = useState("");
    const [newFolderName, setNewFolderName] = useState("");
    const [query, setQuery] = useState("");
    const [managerSize, setManagerSize] = useState<ManagerSize>(loadManagerSize);

    const managerFolderLabel = getFolderFilterLabel(store, activeManagerFolderId);
    const filteredFavorites = useMemo(() => {
        const folderFavorites = favorites.filter(gif => isGifInFolder(store, gif, activeManagerFolderId));
        const lowerQuery = query.trim().toLowerCase();
        if (!lowerQuery) return folderFavorites;

        return folderFavorites.filter(gif =>
            fallbackGifName(gif).toLowerCase().includes(lowerQuery)
            || getSearchTarget(gif).includes(lowerQuery)
        );
    }, [activeManagerFolderId, favorites, query, store]);

    function persist(nextStore: FolderStore) {
        if (!isFolderFilterAvailable(nextStore, activeManagerFolderId)) {
            setActiveManagerFolderId(ALL_FOLDER_ID);
        }

        if (!isFolderFilterAvailable(nextStore, runtime.activeFolderId)) {
            runtime.activeFolderId = ALL_FOLDER_ID;
        }

        setStore(nextStore);
        onStoreChange(nextStore);
        saveStore(nextStore).catch(() => showToast(text.saveError, "failure"));
    }

    function createFolder() {
        const name = newFolderName.trim();
        if (!name) return;

        if (store.folders.some(folder => folder.name.trim().toLowerCase() === name.toLowerCase())) {
            showToast(text.folderExists, "failure");
            return;
        }

        const folder: GifFolder = {
            id: createId(),
            name,
            createdAt: Date.now()
        };

        const nextStore = {
            ...store,
            folders: [...store.folders, folder]
        };

        setActiveManagerFolderId(folder.id);
        persist(nextStore);
        setNewFolderName("");
    }

    function startRenameFolder(folder: GifFolder) {
        setEditingFolderId(folder.id);
        setEditingFolderName(folder.name);
    }

    function cancelRenameFolder() {
        setEditingFolderId(null);
        setEditingFolderName("");
    }

    function commitRenameFolder(folderId: string) {
        const folder = store.folders.find(existingFolder => existingFolder.id === folderId);
        if (!folder) {
            cancelRenameFolder();
            return;
        }

        const name = editingFolderName.trim();
        if (!name) {
            showToast(text.emptyFolderName, "failure");
            return;
        }

        if (name === folder.name) {
            cancelRenameFolder();
            return;
        }

        if (store.folders.some(existingFolder =>
            existingFolder.id !== folderId
            && existingFolder.name.trim().toLowerCase() === name.toLowerCase()
        )) {
            showToast(text.folderExists, "failure");
            return;
        }

        persist({
            ...store,
            folders: store.folders.map(existingFolder =>
                existingFolder.id === folderId
                    ? { ...existingFolder, name }
                    : existingFolder
            )
        });
        cancelRenameFolder();
    }

    function deleteFolder(folderId: string) {
        if (!window.confirm(text.deleteFolderConfirm)) return;

        const assignments = Object.fromEntries(
            Object.entries(store.assignments)
                .map(([gifKey, folderIds]) => [gifKey, folderIds.filter(id => id !== folderId)])
                .filter(([, folderIds]) => folderIds.length > 0)
        ) as Record<string, string[]>;

        if (runtime.activeFolderId === folderId) runtime.activeFolderId = ALL_FOLDER_ID;
        if (activeManagerFolderId === folderId) setActiveManagerFolderId(ALL_FOLDER_ID);
        if (editingFolderId === folderId) cancelRenameFolder();

        persist({
            folders: store.folders.filter(folder => folder.id !== folderId),
            assignments
        });
    }

    function toggleGifFolder(gif: Gif, folderId: string) {
        const gifKey = getGifKey(gif);
        const assignedFolders = new Set(store.assignments[gifKey] ?? []);

        if (assignedFolders.has(folderId)) {
            assignedFolders.delete(folderId);
        } else {
            assignedFolders.add(folderId);
        }

        const nextAssignments = { ...store.assignments };
        const nextAssignedFolders = [...assignedFolders];

        if (nextAssignedFolders.length === 0) {
            delete nextAssignments[gifKey];
        } else {
            nextAssignments[gifKey] = nextAssignedFolders;
        }

        persist({
            ...store,
            assignments: nextAssignments
        });
    }

    function clearGifFolders(gif: Gif) {
        const nextAssignments = { ...store.assignments };
        delete nextAssignments[getGifKey(gif)];

        persist({
            ...store,
            assignments: nextAssignments
        });
    }

    function handleImportStore() {
        importStore(({ store: importedStore, favoriteGifs }) => {
            runtime.activeFolderId = ALL_FOLDER_ID;
            setActiveManagerFolderId(ALL_FOLDER_ID);
            cancelRenameFolder();
            persist(importedStore);

            importFavoriteGifs(favoriteGifs)
                .then(importedCount => {
                    if (importedCount > 0) {
                        showToast(getText().importFavoritesSuccess(importedCount), "success");
                    }
                })
                .catch(error => {
                    console.error("[GifFolders] Failed to import favorite GIFs", error);
                    showToast(getText().importFavoritesError, "failure");
                });
        });
    }

    function selectManagerSize(size: ManagerSize) {
        setManagerSize(size);
        saveManagerSize(size);
    }

    return (
        <div className={`vc-gif-folders-modal-root vc-gif-folders-modal-${managerSize}`}>
        <Modal
            {...modalProps}
            actions={[
                {
                    text: text.close,
                    variant: "secondary",
                    onClick: modalProps.onClose
                }
            ]}
            size="xl"
            subtitle={text.favoritesCount(favorites.length)}
            title={text.managerTitle}
        >
            <div className="vc-gif-folders-size-control" role="group" aria-label={text.sizeLabel}>
                {MANAGER_SIZE_OPTIONS.map(size => (
                    <button
                        aria-pressed={managerSize === size}
                        className={managerSize === size ? "vc-gif-folders-size-button active" : "vc-gif-folders-size-button"}
                        key={size}
                        onClick={() => selectManagerSize(size)}
                        type="button"
                    >
                        {getManagerSizeLabel(text, size)}
                    </button>
                ))}
            </div>

            <div className="vc-gif-folders-manager">
                <section className="vc-gif-folders-manager-folders">
                    <div className="vc-gif-folders-section-title">
                        <HeadingSecondary>{text.foldersHeading}</HeadingSecondary>
                        <small>{text.foldersCount(store.folders.length)}</small>
                    </div>

                    <div className="vc-gif-folders-create-folder">
                        <TextInput
                            value={newFolderName}
                            onChange={setNewFolderName}
                            onKeyDown={event => {
                                if (event.key === "Enter") createFolder();
                            }}
                            placeholder={text.newFolderPlaceholder}
                        />
                        <Button onClick={createFolder} size="small">{text.create}</Button>
                    </div>

                    <div className="vc-gif-folders-folder-list">
                        <ManagerFolderRow
                            active={activeManagerFolderId === ALL_FOLDER_ID}
                            count={favorites.length}
                            label={text.all}
                            onSelect={() => setActiveManagerFolderId(ALL_FOLDER_ID)}
                        />
                        <ManagerFolderRow
                            active={activeManagerFolderId === UNSORTED_FOLDER_ID}
                            count={folderCount(store, favorites, UNSORTED_FOLDER_ID)}
                            label={text.unsorted}
                            onSelect={() => setActiveManagerFolderId(UNSORTED_FOLDER_ID)}
                        />

                        {store.folders.map(folder => editingFolderId === folder.id
                            ? (
                                <div className="vc-gif-folders-folder-row editing" key={folder.id}>
                                    <div className="vc-gif-folders-folder-edit">
                                        <TextInput
                                            autoFocus={true}
                                            value={editingFolderName}
                                            onChange={setEditingFolderName}
                                            onKeyDown={event => {
                                                if (event.key === "Enter") commitRenameFolder(folder.id);
                                                if (event.key === "Escape") cancelRenameFolder();
                                            }}
                                            placeholder={text.folderNamePlaceholder}
                                        />
                                    </div>
                                    <div className="vc-gif-folders-folder-actions">
                                        <Button
                                            onClick={() => commitRenameFolder(folder.id)}
                                            size="small"
                                        >
                                            {text.save}
                                        </Button>
                                        <Button
                                            onClick={cancelRenameFolder}
                                            size="small"
                                            variant="secondary"
                                        >
                                            {text.cancel}
                                        </Button>
                                    </div>
                                </div>
                            )
                            : (
                                <ManagerFolderRow
                                    active={activeManagerFolderId === folder.id}
                                    count={folderCount(store, favorites, folder.id)}
                                    key={folder.id}
                                    label={folder.name}
                                    onSelect={() => setActiveManagerFolderId(folder.id)}
                                >
                                    <Button
                                        onClick={() => startRenameFolder(folder)}
                                        size="small"
                                        variant="secondary"
                                    >
                                        {text.rename}
                                    </Button>
                                    <Button
                                        onClick={() => deleteFolder(folder.id)}
                                        size="small"
                                        variant="dangerSecondary"
                                    >
                                        {text.delete}
                                    </Button>
                                </ManagerFolderRow>
                            )
                        )}

                        {store.folders.length === 0 ? <Paragraph>{text.noFolders}</Paragraph> : null}
                    </div>

                    <div className="vc-gif-folders-backup">
                        <HeadingTertiary>{text.backup}</HeadingTertiary>
                        <div className="vc-gif-folders-backup-actions">
                            <Button
                                onClick={() => exportStore(store).catch(error => {
                                    console.error("[GifFolders] Failed to export favorite GIFs", error);
                                    showToast(getText().saveError, "failure");
                                })}
                                size="small"
                                variant="secondary"
                            >
                                {text.export}
                            </Button>
                            <Button onClick={handleImportStore} size="small" variant="secondary">
                                {text.import}
                            </Button>
                            <Button
                                onClick={() => syncExportFiles().catch(error => {
                                    console.error("[GifFolders] Failed to synchronize GIF exports", error);
                                    showToast(getText().importInvalid, "failure");
                                })}
                                size="small"
                                variant="secondary"
                            >
                                {text.syncExports}
                            </Button>
                        </div>
                    </div>
                </section>

                <section className="vc-gif-folders-manager-gifs">
                    <div className="vc-gif-folders-manager-title">
                        <div className="vc-gif-folders-manager-heading">
                            <HeadingTertiary>{managerFolderLabel}</HeadingTertiary>
                            <span>{text.visibleFavoritesCount(filteredFavorites.length, favorites.length)}</span>
                        </div>
                        <TextInput
                            value={query}
                            onChange={setQuery}
                            placeholder={text.searchPlaceholder}
                        />
                    </div>

                    <div className="vc-gif-folders-assignment-grid">
                        {filteredFavorites.length > 0
                            ? filteredFavorites.map((gif, index) => (
                                <GifAssignmentCard
                                    gif={gif}
                                    key={getGifKey(gif) || `${fallbackGifName(gif)}-${index}`}
                                    onClear={() => clearGifFolders(gif)}
                                    onToggleFolder={folderId => toggleGifFolder(gif, folderId)}
                                    store={store}
                                />
                            ))
                            : (
                                <div className="vc-gif-folders-empty">
                                    <Paragraph>{text.noFavoritesFound}</Paragraph>
                                </div>
                            )}
                    </div>
                </section>
            </div>
        </Modal>
        </div>
    );
}

function GifAssignmentCard({
    gif,
    onClear,
    onToggleFolder,
    store
}: {
    gif: Gif;
    onClear(): void;
    onToggleFolder(folderId: string): void;
    store: FolderStore;
}) {
    const text = getText();
    const assignedFolders = getAssignedFolderIds(store, gif);
    const previewCandidates = getGifPreviews(gif);
    const [previewIndex, setPreviewIndex] = useState(0);
    const preview = previewCandidates[previewIndex];
    const gifName = fallbackGifName(gif);

    useEffect(() => {
        setPreviewIndex(0);
    }, [gif]);

    function tryNextPreview() {
        setPreviewIndex(index => index + 1 < previewCandidates.length ? index + 1 : previewCandidates.length);
    }

    return (
        <article className="vc-gif-folders-assignment-card">
            {preview?.kind === "image"
                ? (
                    <img
                        alt={gifName}
                        loading="lazy"
                        onError={event => {
                            event.currentTarget.removeAttribute("src");
                            tryNextPreview();
                        }}
                        src={preview.url}
                    />
                )
                : null}
            {preview?.kind === "video"
                ? (
                    <video
                        autoPlay
                        loop
                        muted
                        onError={event => {
                            event.currentTarget.removeAttribute("src");
                            tryNextPreview();
                        }}
                        playsInline
                        preload="metadata"
                        src={preview.url}
                    />
                )
                : null}

            <div className="vc-gif-folders-image-fallback" hidden={Boolean(preview)}>
                {text.previewUnavailable}
            </div>

            <div className="vc-gif-folders-assignment-body">
                <strong title={gifName}>{gifName}</strong>

                <div className="vc-gif-folders-assignment-chips">
                    {store.folders.length > 0
                        ? store.folders.map(folder => (
                            <button
                                aria-pressed={assignedFolders.includes(folder.id)}
                                className={assignedFolders.includes(folder.id) ? "vc-gif-folders-chip active" : "vc-gif-folders-chip"}
                                key={folder.id}
                                onClick={() => onToggleFolder(folder.id)}
                                title={folder.name}
                                type="button"
                            >
                                <span>{folder.name}</span>
                            </button>
                        ))
                        : <Paragraph>{text.createFolderHint}</Paragraph>}
                </div>

                <Button
                    disabled={assignedFolders.length === 0}
                    onClick={onClear}
                    size="small"
                    variant="secondary"
                >
                    {text.clearFolders}
                </Button>
            </div>
        </article>
    );
}

export default definePlugin({
    name: "GifFolders",
    description: getText().pluginDescription,
    authors: [{ name: "local", id: 0n }],
    tags: ["Media", "Utility", "Customisation"],

    start() {
        startDomFallback();
    },

    stop() {
        stopDomFallback();
        nativeHeaderPatchActive = false;
        runtime.instance = null;
        runtime.activeFolderId = ALL_FOLDER_ID;
        runtime.query = "";
    },

    patches: [
        {
            find: "renderHeaderContent()",
            replacement: [
                {
                    match: /(renderHeaderContent\(\).{1,150}FAVORITES:return)(.{1,150});(case.{1,200}default:.{0,50}?return\(0,\i\.jsx\)\((?<searchComp>\i\.\i),)/,
                    replace: "$1 this?.state?.resultType === 'Favorites' ? $self.renderFavoritesHeader(this, $<searchComp>) : $2;$3"
                },
                {
                    match: /(,suggestions:\i,favorites:)(\i),/,
                    replace: "$1$self.getFavorites($2),favCopy:$2,"
                }
            ]
        }
    ],

    renderFavoritesHeader(instance: Instance, SearchBarComponent: SearchBarComponent) {
        nativeHeaderPatchActive = true;
        runtime.instance = instance;

        return (
            <ErrorBoundary noop>
                <GifFoldersHeader instance={instance} SearchBarComponent={SearchBarComponent} />
            </ErrorBoundary>
        );
    },

    getFavorites(favorites: Gif[]) {
        return filterFavorites(favorites);
    }
});
