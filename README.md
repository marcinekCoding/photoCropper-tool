# Photo Cropper

Narzędzie webowe do masowego kadrowania zdjęć — działa w pełni lokalnie w przeglądarce (Chrome / Edge).

## Wymagania

- Node.js 18+
- Przeglądarka z obsługą [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) (Chrome, Edge)

## Uruchomienie

```bash
npm install
npm run dev
```

Aplikacja będzie dostępna pod adresem wyświetlonym w terminalu (domyślnie `http://localhost:5173`).

## Build produkcyjny

```bash
npm run build
npm run preview
```

## Przepływ aplikacji

1. **Wymiar** — wybór presetu (300×400, 1920×1080, 1:1, 4:3, 9:16) lub własny rozmiar.
2. **Folder** — wybór folderu źródłowego; wczytanie plików JPG, PNG, WebP.
3. **Kadrowanie** — przegląd kolejki zdjęć z podglądem i zapisem do podfolderu `cropped/`.

## Struktura projektu

```
src/
├── types.ts              # Wspólne typy (CropDimensions, QueuedImage, SessionState)
├── hooks/useSession.ts   # Stan sesji i nawigacja między krokami
├── components/
│   ├── DimensionPicker.tsx
│   ├── FolderPicker.tsx
│   ├── CropSession.tsx   # Orkiestracja kolejki
│   └── CropWorkspace/    # UI kadrowania (Agent 2)
└── lib/
    ├── crop.ts           # Logika kadru (Agent 2)
    ├── faceDetection.ts  # Wykrywanie twarzy (Agent 3)
    └── export.ts         # Eksport do podfolderu (Agent 3)
```

## Integracja dla agentów

### Agent 2 — Kadrowanie (UI + crop math)

- **`src/components/CropWorkspace/index.tsx`** — zaimplementuj dwupanelowy interfejs. Props: `CropWorkspaceProps`.
- **`src/lib/crop.ts`** — obliczenia prostokąta kadru, podgląd na canvas.

### Agent 3 — Twarze + eksport

- **`src/lib/faceDetection.ts`** — inicjalizacja modelu, `detectFaces`, `centerCropOnFace`.
- **`src/lib/export.ts`** — zapis do `cropped/` w folderze źródłowym, upscale małych zdjęć.

Wspólne typy eksportowane z `src/types.ts`.
