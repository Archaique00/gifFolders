# GifFolders for Vencord / Equicord / Vesktop

GifFolders is a Vencord / Equicord userplugin that adds local folders to Discord's native favorite GIF picker.

This repository contains the current local version:

```txt
gifFolders/
└── 2.0/
    ├── README.md
    ├── index.tsx
    └── styles.css
```

## Versions

### 2.0

Current version with the updated manager UI and automatic English/French language detection.

Use:

```txt
gifFolders/2.0/
```

## Features

- Organize favorite GIFs into local folders.
- Filter favorites by `All`, `Unsorted`, or a custom folder.
- Assign one GIF to multiple folders.
- Search inside favorite GIFs.
- Create, rename, and delete folders.
- Export and import folders and all native favorite GIFs as JSON.
- Synchronize two GifFolders export files into one merged export.
- Resize the GIF manager window.
- Store data locally with Vencord `DataStore`.
- English/French UI depending on Discord/browser language.

## Screenshots

![GifFolders manager small window](assets/gif-folders-manager-small.png)

![GifFolders manager large window](assets/gif-folders-manager-large.png)

![GifFolders manager almost fullscreen](assets/gif-folders-manager-fullscreen.png)

## Manual Install

Vencord custom userplugins must be installed manually in a local Vencord source checkout.

Copy the version `2.0` files into your Vencord source folder:

```txt
Vencord/src/userplugins/gifFolders/
```

The final plugin path must look like this:

```txt
Vencord/src/userplugins/gifFolders/index.tsx
Vencord/src/userplugins/gifFolders/styles.css
```

Do not copy it as:

```txt
Vencord/src/userplugins/gifFolders/2.0/index.tsx
```

## Build

From your Vencord source folder:

```sh
pnpm build --dev
```

If `pnpm` is not directly available:

```sh
corepack pnpm build --dev
```

## Vesktop

After building Vencord:

1. Open Vesktop settings.
2. Set the Vencord location to your Vencord `dist` folder.
3. Fully quit and restart Vesktop.
4. Enable `GifFolders` in Vencord plugins.

## Discord Desktop

After building Vencord:

```sh
pnpm inject
```

Then fully restart Discord and enable `GifFolders` in Vencord plugins.

## Backup

Use `Export` in the GifFolders manager to save folders, assignments, and all
native Discord favorite GIF entries as JSON.

Use `Import` to restore them later. Missing favorite GIFs are added in one
Discord settings update; favorites already present are kept unchanged.

Use `Sync exports` to select exactly two GifFolders JSON exports and download a
new merged export. Folders with the same name are combined, GIF assignments are
deduplicated, and favorite GIF entries from both files are preserved.

The backup does not contain Discord tokens. It contains the metadata and URLs
Discord needs to restore the native favorite GIF list; it does not embed or
download the GIF media files themselves.
