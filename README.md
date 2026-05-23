# GifFolders for Vencord / Vesktop

GifFolders is a Vencord userplugin that adds local folders to Discord's native favorite GIF picker.

This repository contains two local versions:

```txt
gifFolders/
├── 1.0/
│   ├── README.md
│   ├── index.tsx
│   └── styles.css
└── 2.0/
    ├── index.tsx
    └── styles.css
```

## Versions

### 1.0

Stable version.

Use:

```txt
gifFolders/1.0/
```

### 2.0

Newer version with the updated manager UI and automatic English/French language detection.

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
- Export and import folder data as JSON.
- Store data locally with Vencord `DataStore`.
- English/French UI depending on Discord/browser language.

## Screenshots

![GifFolders picker filters](assets/gif-folders-picker.png)

![GifFolders folder manager](assets/gif-folders-manager.png)

## Manual Install

Vencord custom userplugins must be installed manually in a local Vencord source checkout.

1. Pick a version:
   - `gifFolders/1.0`
   - `gifFolders/2.0`
2. Copy that version's files into your Vencord source folder:

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

Use `Export` in the GifFolders manager to save folders and assignments as JSON.

Use `Import` to restore them later.

The backup only contains GifFolders data. It does not include Discord tokens or Discord/Tenor favorite data.
