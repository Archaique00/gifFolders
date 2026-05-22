# GifFolders for Vencord / Vesktop

GifFolders is a local Vencord userplugin that adds folders to the native Discord GIF favorites picker.

The plugin UI supports French and English. It uses French when Discord/browser locale starts with `fr`; otherwise it uses English.

## Francais

### A savoir avant de partager

Vencord ne permet pas d'installer un userplugin prive avec un simple bouton dans la version officielle. D'apres la documentation Vencord, les plugins custom doivent etre places dans `src/userplugins`, puis Vencord doit etre recompile depuis les sources.

Pour le partager proprement, publie ce depot sur GitHub ou en ZIP avec ces fichiers :

- `gifFolders/`
- `install-userplugin.sh`
- `install-userplugin.ps1`
- `README.md`

Avant publication, tu peux aussi remplacer l'auteur dans `gifFolders/index.tsx` :

```ts
authors: [{ name: "TonNom", id: 123456789012345678n }],
```

### Prerequis

L'utilisateur doit avoir Git, Node.js et pnpm, puis un dossier source Vencord fonctionnel.

Installation de Vencord depuis zero :

```bash
git clone https://github.com/Vendicated/Vencord
cd Vencord
pnpm install --frozen-lockfile
```

### Installation rapide du plugin

Telecharge ou clone ce depot, puis lance la commande adaptee depuis le dossier `vencord-gif-pluggin`.

Windows PowerShell :

```powershell
powershell -ExecutionPolicy Bypass -File .\install-userplugin.ps1 -VencordPath "$env:USERPROFILE\Documents\Vencord"
```

Linux :

```bash
chmod +x ./install-userplugin.sh
./install-userplugin.sh "$HOME/Documents/Vencord"
```

Installation manuelle :

1. Cree `src/userplugins` dans le dossier source Vencord si besoin.
2. Copie le dossier `gifFolders` vers `src/userplugins/gifFolders`.
3. Verifie que le fichier d'entree est bien `src/userplugins/gifFolders/index.tsx`.

### Build pour Discord Desktop avec Vencord injecte

Depuis le dossier source Vencord :

```bash
pnpm build --dev
pnpm inject
```

Redemarre Discord, puis active `GifFolders` dans les plugins Vencord.

### Build pour Vesktop

Depuis le dossier source Vencord :

```bash
pnpm build --dev
```

Ensuite dans Vesktop :

1. Ouvre `Vesktop Settings`.
2. Va dans `Vencord Location`.
3. Clique `Change`.
4. Selectionne le dossier `dist` de ton dossier source Vencord.
5. Redemarre completement Vesktop.
6. Active `GifFolders` dans les plugins Vencord.

Sur Linux avec Vesktop Flatpak, donne l'acces au dossier Vencord si le chemin devient temporaire :

```bash
flatpak override dev.vencord.Vesktop --filesystem="$HOME/Documents/Vencord"
```

### Utilisation

- Ouvre le picker GIF, puis l'onglet favoris.
- Cree des dossiers avec `Classer`.
- Filtre avec `Tous`, `Non ranges` ou un dossier.
- Coche les dossiers sur chaque GIF pour le ranger.
- Utilise `Exporter` pour sauvegarder la configuration en JSON.
- Utilise `Importer` apres une reinstallation pour restaurer les dossiers.

Le plugin ne modifie pas les favoris Discord/Tenor. Il stocke seulement les dossiers et affectations localement via le `DataStore` de Vencord.

## English

### Before Sharing

Vencord does not install private userplugins with a one-click button in the official build. According to the Vencord documentation, custom plugins must be placed in `src/userplugins`, then Vencord must be rebuilt from source.

To share this plugin cleanly, publish this repository on GitHub or as a ZIP containing:

- `gifFolders/`
- `install-userplugin.sh`
- `install-userplugin.ps1`
- `README.md`

Before publishing, you can also replace the author in `gifFolders/index.tsx`:

```ts
authors: [{ name: "YourName", id: 123456789012345678n }],
```

### Prerequisites

Users need Git, Node.js, pnpm, and a working Vencord source folder.

Fresh Vencord source install:

```bash
git clone https://github.com/Vendicated/Vencord
cd Vencord
pnpm install --frozen-lockfile
```

### Quick Plugin Install

Download or clone this repository, then run the matching command from the `vencord-gif-pluggin` folder.

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-userplugin.ps1 -VencordPath "$env:USERPROFILE\Documents\Vencord"
```

Linux:

```bash
chmod +x ./install-userplugin.sh
./install-userplugin.sh "$HOME/Documents/Vencord"
```

Manual install:

1. Create `src/userplugins` inside the Vencord source folder if needed.
2. Copy `gifFolders` to `src/userplugins/gifFolders`.
3. Make sure the entry file is `src/userplugins/gifFolders/index.tsx`.

### Build for Discord Desktop with injected Vencord

From the Vencord source folder:

```bash
pnpm build --dev
pnpm inject
```

Restart Discord, then enable `GifFolders` in Vencord plugins.

### Build for Vesktop

From the Vencord source folder:

```bash
pnpm build --dev
```

Then in Vesktop:

1. Open `Vesktop Settings`.
2. Go to `Vencord Location`.
3. Press `Change`.
4. Select the `dist` folder in your Vencord source folder.
5. Fully restart Vesktop.
6. Enable `GifFolders` in Vencord plugins.

On Linux with Vesktop Flatpak, grant access to the Vencord folder if the path becomes temporary:

```bash
flatpak override dev.vencord.Vesktop --filesystem="$HOME/Documents/Vencord"
```

### Usage

- Open the GIF picker, then the favorites tab.
- Create folders with `Organize`.
- Filter with `All`, `Unsorted`, or a folder.
- Check folders on each GIF to assign it.
- Use `Export` to save the configuration as JSON.
- Use `Import` after reinstalling to restore folders.

The plugin does not change Discord/Tenor favorites. It only stores folders and assignments locally through Vencord `DataStore`.

## Official References

- Vencord custom plugins: https://docs.vencord.dev/installing/custom-plugins/
- Vencord source install and build: https://docs.vencord.dev/installing/
