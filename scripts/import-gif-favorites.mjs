#!/usr/bin/env node

import fs from "node:fs/promises";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const DEFAULT_API_BASE = "https://discord.com/api/v9";
const FRECENCY_SETTINGS_PROTO_TYPE = 2;

function usage() {
    return `Usage:
  node scripts/import-gif-favorites.mjs <export.json> [options]

Options:
  --token <token>      Discord user token. Prefer DISCORD_TOKEN instead.
  --yes               Import without interactive confirmation.
  --dry-run           Parse and compare only. Does not PATCH Discord.
  --replace           Replace current favorite GIFs instead of merging.
  --api <url>         Discord API base URL. Default: ${DEFAULT_API_BASE}
  --help              Show this help.

Examples:
  DISCORD_TOKEN="..." node scripts/import-gif-favorites.mjs gif-folders.json --yes
  node scripts/import-gif-favorites.mjs gif-folders.json --dry-run`;
}

function parseArgs(argv) {
    const options = {
        apiBase: process.env.DISCORD_API_BASE || DEFAULT_API_BASE,
        dryRun: false,
        jsonPath: "",
        replace: false,
        token: process.env.DISCORD_TOKEN || "",
        yes: false
    };

    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index];

        if (arg === "--help" || arg === "-h") {
            console.log(usage());
            process.exit(0);
        }

        if (arg === "--dry-run") {
            options.dryRun = true;
            continue;
        }

        if (arg === "--replace") {
            options.replace = true;
            continue;
        }

        if (arg === "--yes" || arg === "-y") {
            options.yes = true;
            continue;
        }

        if (arg === "--token") {
            options.token = argv[++index] || "";
            continue;
        }

        if (arg === "--api") {
            options.apiBase = argv[++index] || "";
            continue;
        }

        if (arg.startsWith("-")) {
            throw new Error(`Unknown option: ${arg}`);
        }

        if (options.jsonPath) {
            throw new Error(`Unexpected extra argument: ${arg}`);
        }

        options.jsonPath = arg;
    }

    if (!options.jsonPath) throw new Error("Missing JSON export path.");
    if (!options.apiBase) throw new Error("Missing Discord API base URL.");

    return options;
}

function isImportableGifUrl(value) {
    if (typeof value !== "string") return false;

    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
    } catch {
        return false;
    }
}

function numberOrUndefined(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0
        ? Math.floor(value)
        : undefined;
}

function normalizeGifEntry(url, entry) {
    const source = entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
    const normalized = {};

    const format = numberOrUndefined(source.format);
    const width = numberOrUndefined(source.width);
    const height = numberOrUndefined(source.height);
    const order = numberOrUndefined(source.order);
    const src = typeof source.src === "string"
        ? source.src
        : typeof source.gifSrc === "string"
            ? source.gifSrc
            : typeof source.gif_src === "string"
                ? source.gif_src
                : undefined;

    if (format !== undefined) normalized.format = format;
    if (src) normalized.src = src;
    if (width !== undefined) normalized.width = width;
    if (height !== undefined) normalized.height = height;
    if (order !== undefined) normalized.order = order;

    if (!normalized.src && /\.(gif|webp|mp4)(\?|$)/i.test(url)) normalized.src = url;

    return normalized;
}

function addFavoriteRecord(target, value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;

    const record = value.gifs && typeof value.gifs === "object" && !Array.isArray(value.gifs)
        ? value.gifs
        : value;

    for (const [url, entry] of Object.entries(record)) {
        if (!isImportableGifUrl(url)) continue;
        target.set(url, normalizeGifEntry(url, entry));
    }
}

function addAssignmentUrls(target, value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;

    const store = value.store && typeof value.store === "object" ? value.store : value;
    const assignments = store.assignments;
    if (!assignments || typeof assignments !== "object" || Array.isArray(assignments)) return;

    for (const url of Object.keys(assignments)) {
        if (isImportableGifUrl(url) && !target.has(url)) target.set(url, normalizeGifEntry(url, {}));
    }
}

function readImportedGifs(json) {
    const imported = new Map();

    if (json && typeof json === "object" && !Array.isArray(json) && json.favoriteGifs) {
        addFavoriteRecord(imported, json.favoriteGifs);
    } else {
        addFavoriteRecord(imported, json);
    }

    addAssignmentUrls(imported, json);

    if (imported.size === 0) {
        throw new Error("No favorite GIF entries found in this JSON.");
    }

    return imported;
}

function readVarint(buffer, offset) {
    let value = 0;
    let shift = 0;
    let cursor = offset;

    while (cursor < buffer.length) {
        const byte = buffer[cursor++];
        value += (byte & 0x7f) * 2 ** shift;
        if ((byte & 0x80) === 0) return { value, offset: cursor };
        shift += 7;
        if (shift > 56) throw new Error("Invalid protobuf varint.");
    }

    throw new Error("Unexpected end of protobuf varint.");
}

function encodeVarint(value) {
    let remaining = Math.floor(Number(value));
    if (!Number.isFinite(remaining) || remaining < 0) throw new Error(`Invalid uint value: ${value}`);

    const bytes = [];
    while (remaining > 0x7f) {
        bytes.push((remaining & 0x7f) | 0x80);
        remaining = Math.floor(remaining / 128);
    }
    bytes.push(remaining);
    return Buffer.from(bytes);
}

function encodeTag(fieldNumber, wireType) {
    return encodeVarint((fieldNumber << 3) | wireType);
}

function encodeLengthDelimited(fieldNumber, payload) {
    return Buffer.concat([
        encodeTag(fieldNumber, 2),
        encodeVarint(payload.length),
        payload
    ]);
}

function encodeString(fieldNumber, value) {
    return encodeLengthDelimited(fieldNumber, Buffer.from(value, "utf8"));
}

function encodeUint(fieldNumber, value) {
    return Buffer.concat([encodeTag(fieldNumber, 0), encodeVarint(value)]);
}

function skipField(buffer, offset, wireType) {
    if (wireType === 0) return readVarint(buffer, offset).offset;
    if (wireType === 1) return offset + 8;
    if (wireType === 2) {
        const length = readVarint(buffer, offset);
        return length.offset + length.value;
    }
    if (wireType === 5) return offset + 4;

    throw new Error(`Unsupported protobuf wire type: ${wireType}`);
}

function decodeLengthDelimited(buffer, offset) {
    const length = readVarint(buffer, offset);
    const end = length.offset + length.value;
    if (end > buffer.length) throw new Error("Invalid protobuf length-delimited field.");
    return { value: buffer.subarray(length.offset, end), offset: end };
}

function decodeString(buffer, offset) {
    const decoded = decodeLengthDelimited(buffer, offset);
    return { value: decoded.value.toString("utf8"), offset: decoded.offset };
}

function decodeVersions(buffer) {
    let cursor = 0;
    let dataVersion;

    while (cursor < buffer.length) {
        const tag = readVarint(buffer, cursor);
        cursor = tag.offset;
        const fieldNumber = tag.value >> 3;
        const wireType = tag.value & 7;

        if (fieldNumber === 3 && wireType === 0) {
            const decoded = readVarint(buffer, cursor);
            dataVersion = decoded.value;
            cursor = decoded.offset;
        } else {
            cursor = skipField(buffer, cursor, wireType);
        }
    }

    return { dataVersion };
}

function decodeFavoriteGif(buffer) {
    let cursor = 0;
    const gif = {};

    while (cursor < buffer.length) {
        const tag = readVarint(buffer, cursor);
        cursor = tag.offset;
        const fieldNumber = tag.value >> 3;
        const wireType = tag.value & 7;

        if (wireType === 0 && [1, 3, 4, 5].includes(fieldNumber)) {
            const decoded = readVarint(buffer, cursor);
            if (fieldNumber === 1) gif.format = decoded.value;
            if (fieldNumber === 3) gif.width = decoded.value;
            if (fieldNumber === 4) gif.height = decoded.value;
            if (fieldNumber === 5) gif.order = decoded.value;
            cursor = decoded.offset;
        } else if (fieldNumber === 2 && wireType === 2) {
            const decoded = decodeString(buffer, cursor);
            gif.src = decoded.value;
            cursor = decoded.offset;
        } else {
            cursor = skipField(buffer, cursor, wireType);
        }
    }

    return gif;
}

function decodeFavoriteGifMapEntry(buffer) {
    let cursor = 0;
    let key = "";
    let value = {};

    while (cursor < buffer.length) {
        const tag = readVarint(buffer, cursor);
        cursor = tag.offset;
        const fieldNumber = tag.value >> 3;
        const wireType = tag.value & 7;

        if (fieldNumber === 1 && wireType === 2) {
            const decoded = decodeString(buffer, cursor);
            key = decoded.value;
            cursor = decoded.offset;
        } else if (fieldNumber === 2 && wireType === 2) {
            const decoded = decodeLengthDelimited(buffer, cursor);
            value = decodeFavoriteGif(decoded.value);
            cursor = decoded.offset;
        } else {
            cursor = skipField(buffer, cursor, wireType);
        }
    }

    return key ? [key, value] : null;
}

function decodeFavoriteGifs(buffer) {
    let cursor = 0;
    const favoriteGifs = {
        gifs: {},
        hideTooltip: false
    };

    while (cursor < buffer.length) {
        const tag = readVarint(buffer, cursor);
        cursor = tag.offset;
        const fieldNumber = tag.value >> 3;
        const wireType = tag.value & 7;

        if (fieldNumber === 1 && wireType === 2) {
            const decoded = decodeLengthDelimited(buffer, cursor);
            const entry = decodeFavoriteGifMapEntry(decoded.value);
            if (entry) favoriteGifs.gifs[entry[0]] = entry[1];
            cursor = decoded.offset;
        } else if (fieldNumber === 2 && wireType === 0) {
            const decoded = readVarint(buffer, cursor);
            favoriteGifs.hideTooltip = decoded.value !== 0;
            cursor = decoded.offset;
        } else {
            cursor = skipField(buffer, cursor, wireType);
        }
    }

    return favoriteGifs;
}

function decodeFrecencySettings(base64Settings) {
    const buffer = Buffer.from(base64Settings || "", "base64");
    let cursor = 0;
    const decoded = {
        dataVersion: undefined,
        favoriteGifs: { gifs: {}, hideTooltip: false }
    };

    while (cursor < buffer.length) {
        const tag = readVarint(buffer, cursor);
        cursor = tag.offset;
        const fieldNumber = tag.value >> 3;
        const wireType = tag.value & 7;

        if (fieldNumber === 1 && wireType === 2) {
            const field = decodeLengthDelimited(buffer, cursor);
            decoded.dataVersion = decodeVersions(field.value).dataVersion;
            cursor = field.offset;
        } else if (fieldNumber === 2 && wireType === 2) {
            const field = decodeLengthDelimited(buffer, cursor);
            decoded.favoriteGifs = decodeFavoriteGifs(field.value);
            cursor = field.offset;
        } else {
            cursor = skipField(buffer, cursor, wireType);
        }
    }

    return decoded;
}

function encodeFavoriteGif(gif) {
    const parts = [];

    if (gif.format !== undefined) parts.push(encodeUint(1, gif.format));
    if (gif.src) parts.push(encodeString(2, gif.src));
    if (gif.width !== undefined) parts.push(encodeUint(3, gif.width));
    if (gif.height !== undefined) parts.push(encodeUint(4, gif.height));
    if (gif.order !== undefined) parts.push(encodeUint(5, gif.order));

    return Buffer.concat(parts);
}

function encodeFavoriteGifMapEntry(url, gif) {
    return encodeLengthDelimited(1, Buffer.concat([
        encodeString(1, url),
        encodeLengthDelimited(2, encodeFavoriteGif(gif))
    ]));
}

function encodeFavoriteGifs(favoriteGifs) {
    const parts = [];

    for (const [url, gif] of Object.entries(favoriteGifs.gifs)) {
        parts.push(encodeFavoriteGifMapEntry(url, gif));
    }

    if (favoriteGifs.hideTooltip) parts.push(encodeUint(2, 1));

    return Buffer.concat(parts);
}

function encodeFrecencyFavoriteGifsPatch(favoriteGifs) {
    return encodeLengthDelimited(2, encodeFavoriteGifs(favoriteGifs)).toString("base64");
}

function getNextOrder(gifs) {
    let max = 0;
    for (const gif of Object.values(gifs)) {
        const order = numberOrUndefined(gif.order) ?? 0;
        if (order > max) max = order;
    }
    return max + 1;
}

function sortedImportedEntries(imported) {
    return [...imported.entries()].sort((left, right) => {
        const leftOrder = numberOrUndefined(left[1].order) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = numberOrUndefined(right[1].order) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return left[0].localeCompare(right[0]);
    });
}

function mergeFavoriteGifs(currentFavoriteGifs, imported, replace) {
    const merged = {
        gifs: replace ? {} : { ...currentFavoriteGifs.gifs },
        hideTooltip: currentFavoriteGifs.hideTooltip
    };
    const added = [];
    let nextOrder = replace ? 1 : getNextOrder(merged.gifs);

    for (const [url, importedGif] of sortedImportedEntries(imported)) {
        if (!replace && Object.prototype.hasOwnProperty.call(merged.gifs, url)) continue;

        merged.gifs[url] = {
            ...importedGif,
            order: nextOrder++
        };
        added.push(url);
    }

    return {
        added,
        favoriteGifs: merged,
        totalAfter: Object.keys(merged.gifs).length
    };
}

async function discordRequest(apiBase, token, method, path, body) {
    if (typeof fetch !== "function") {
        throw new Error("This script needs Node.js 18+ because it uses fetch().");
    }

    const response = await fetch(`${apiBase.replace(/\/$/, "")}${path}`, {
        method,
        headers: {
            "Accept": "application/json",
            "Authorization": token,
            "Content-Type": "application/json"
        },
        body: body ? JSON.stringify(body) : undefined
    });

    const text = await response.text();
    let json = {};

    if (text) {
        try {
            json = JSON.parse(text);
        } catch {
            json = { raw: text };
        }
    }

    if (!response.ok) {
        const detail = json.message || json.raw || response.statusText;
        throw new Error(`Discord API ${response.status}: ${detail}`);
    }

    return json;
}

async function fetchFrecencySettings(apiBase, token) {
    const json = await discordRequest(
        apiBase,
        token,
        "GET",
        `/users/@me/settings-proto/${FRECENCY_SETTINGS_PROTO_TYPE}`
    );

    if (typeof json.settings !== "string") {
        throw new Error("Discord response did not include settings.");
    }

    return decodeFrecencySettings(json.settings);
}

async function patchFrecencySettings(apiBase, token, favoriteGifs, dataVersion) {
    const body = {
        settings: encodeFrecencyFavoriteGifsPatch(favoriteGifs)
    };

    if (dataVersion !== undefined) body.required_data_version = dataVersion;

    return discordRequest(
        apiBase,
        token,
        "PATCH",
        `/users/@me/settings-proto/${FRECENCY_SETTINGS_PROTO_TYPE}`,
        body
    );
}

async function confirmImport(summary) {
    if (!process.stdin.isTTY) {
        throw new Error("Interactive confirmation is not available. Re-run with --yes.");
    }

    const rl = readline.createInterface({ input, output });
    try {
        const answer = await rl.question(
            `Type IMPORT to ${summary.replace ? "replace with" : "add"} ${summary.added} GIF(s) on this Discord account: `
        );
        if (answer.trim() !== "IMPORT") throw new Error("Import cancelled.");
    } finally {
        rl.close();
    }
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const json = JSON.parse(await fs.readFile(options.jsonPath, "utf8"));
    const imported = readImportedGifs(json);

    console.log(`JSON: ${imported.size} importable GIF(s) found.`);

    if (options.dryRun && !options.token) {
        console.log("Dry run without token: JSON validated only.");
        return;
    }

    if (!options.token) {
        throw new Error("Missing Discord token. Set DISCORD_TOKEN or pass --token.");
    }

    const current = await fetchFrecencySettings(options.apiBase, options.token);
    const firstMerge = mergeFavoriteGifs(current.favoriteGifs, imported, options.replace);

    console.log(`Discord account: ${Object.keys(current.favoriteGifs.gifs).length} current favorite GIF(s).`);

    if (options.dryRun) {
        console.log(`${options.replace ? "Would replace with" : "Would add"} ${firstMerge.added.length} GIF(s).`);
        console.log(`Final total would be ${firstMerge.totalAfter} favorite GIF(s).`);
        return;
    }

    if (firstMerge.added.length === 0 && !options.replace) {
        console.log("Nothing to import: every JSON GIF is already in favorites.");
        return;
    }

    if (!options.yes) {
        await confirmImport({ added: firstMerge.added.length, replace: options.replace });
    }

    let response = await patchFrecencySettings(
        options.apiBase,
        options.token,
        firstMerge.favoriteGifs,
        current.dataVersion
    );

    if (response.out_of_date) {
        console.log("Discord reported an out-of-date settings version. Retrying once with fresh settings...");
        const fresh = await fetchFrecencySettings(options.apiBase, options.token);
        const retryMerge = mergeFavoriteGifs(fresh.favoriteGifs, imported, options.replace);
        response = await patchFrecencySettings(
            options.apiBase,
            options.token,
            retryMerge.favoriteGifs,
            fresh.dataVersion
        );

        if (response.out_of_date) {
            throw new Error("Discord rejected the update as out-of-date after retry.");
        }

        console.log(`Imported ${retryMerge.added.length} GIF(s). Final total: ${retryMerge.totalAfter}.`);
        return;
    }

    console.log(`Imported ${firstMerge.added.length} GIF(s). Final total: ${firstMerge.totalAfter}.`);
}

main().catch(error => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
});
