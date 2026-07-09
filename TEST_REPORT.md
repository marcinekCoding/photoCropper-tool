# Photo Cropper — Test Report (Agent 4 / QA)

**Date:** 2026-07-09  
**Workspace:** `/Users/marcinpawlak/Documents/STUDIA/SEM_3/photo_cropper`  
**Spec reference:** `pomysl.md`

---

## Build / Dev Server Status

| Command | Status | Notes |
|---------|--------|-------|
| `npm install` | ✅ Pass | 142 packages installed |
| `npm run build` | ✅ Pass | `tsc -b && vite build` — 44 modules, ~275 kB JS bundle |
| `npm run dev` | ✅ Running | **http://localhost:5174/** (5173 was in use) |

### Critical fixes applied during QA

1. **`CropSession` ↔ `faceDetection` API mismatch** — import updated from non-existent `proposeCropStateFromFaces` to `computeCenteredCrop`.
2. **`vite-env.d.ts`** — added File System Access API type declarations so `FolderPicker` type-checks.
3. **`CropWorkspace.tsx`** — removed unused `rightContainerSize` (blocked strict build).
4. **Removed duplicate stub** — conflicting `CropWorkspace/index.tsx` stub was superseded by full `CropWorkspace.tsx` implementation.

---

## Spec Verification (vs `pomysl.md`)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Dimension picker (presets + custom) | ✅ | `DimensionPicker.tsx`, `DIMENSION_PRESETS` in `types.ts` |
| Folder selection loads images | ✅ | `FolderPicker.tsx` via `showDirectoryPicker`, JPG/PNG/WebP |
| Dual panel UI (original left, cropped right) | ✅ | `CropWorkspace.tsx` — two panels + overlay on original |
| Pan + zoom on right panel | ✅ | Pointer drag + mouse wheel in `CropWorkspace.tsx` |
| Face auto-center (or fallback center) | ✅ | MediaPipe in `faceDetection.ts`, wired in `CropSession.tsx`; fallback `{ offsetX: 0, offsetY: 0, scale: 1 }` on error |
| Keyboard shortcuts | ⚠️ Partial | Enter/Space, Esc, arrows ✅ — **Backspace missing** |
| Export to `cropped/` subfolder | ✅ | `export.ts` → `ensureOutputDirectory` + `saveCroppedImage` |
| Small image upscale | ✅ | `applyCropToCanvas` always renders to target width×height |
| Offline / local processing | ✅ | All processing in-browser; MediaPipe WASM served from `/public/mediapipe/` |
| Image queue + counter | ✅ | `useSession.ts` + counter in `CropWorkspace` / `CropSession` |
| Manual review before save | ✅ | OK button / Enter triggers export then advance |

---

## What Works ✅

- **3-step flow:** dimensions → folder → crop (`App.tsx` + `useSession.ts`)
- **Presets:** 300×400, 1920×1080, 1:1, 4:3, 9:16 + custom dimensions with validation
- **Folder pick:** Chrome/Edge File System Access API with read/write permission
- **Crop UI:** Live preview canvas (right), full image with crop overlay (left)
- **Crop math:** Cover-fit base crop, clamped pan/zoom (`lib/crop.ts`)
- **Face proposal:** MediaPipe Face Detection loads once; centers crop on largest face without changing scale
- **Export:** Writes to `cropped/` subfolder with original filenames; JPEG quality 0.92
- **Session end screen:** Shows processed/saved counts with restart / change-folder actions
- **Responsive layout:** Dual panels stack on narrow viewports
- **Integration:** `CropSession` loads image → detects faces → passes `initialCropState` → `CropWorkspace` → `exportCroppedImage` on accept

---

## What's Broken ❌

_No blocking runtime bugs confirmed in static/code review after fixes._ Build and TypeScript compile cleanly.

**Previously broken (fixed in this QA pass):**

- TypeScript build failed due to prop/API mismatches between agents — **resolved**.
- Dev server dependency scan failed on missing `proposeCropStateFromFaces` export — **resolved**.

**Potential runtime risks (need browser verification):**

- MediaPipe WASM/model load failure would fall back to image-center crop (catch in `CropSession`) — not a crash, but face centering would silently not work.
- Export requires user-granted write permission; denial shows Polish error message.

---

## What's Missing ⚠️

| Item | Spec reference | Notes |
|------|----------------|-------|
| **Backspace** to skip | Keyboard shortcuts | Only `Escape` mapped to skip |
| **Nested folder scan** | Folder selection | Only top-level files in chosen directory |
| **Undo export on Cofnij** | Cofnij = previous | `goBack()` decrements index/count but does not delete file from `cropped/` |
| **Crop overlay sync delay** | Face auto-center | Brief center crop may flash before face-adjusted `initialCropState` arrives |
| **Zoom slider** | UI spec | Wheel/pinch only; no slider control |
| **PWA / service worker** | Optional in spec | Not implemented |
| **Unused deps** | — | `face-api.js`, `@tensorflow/tfjs` in `package.json` but unused (MediaPipe chosen instead) |
| **Batch accept, EXIF rotate, custom presets** | “Później” section | Correctly deferred |

---

## Integration Review

```
App.tsx
  └─ useSession (step state, queue, index)
  └─ DimensionPicker → setDimensions
  └─ FolderPicker → setFolder (FileSystemDirectoryHandle + queue)
  └─ CropSession
       ├─ initFaceDetection() on mount
       ├─ detectFaces(img) → computeCenteredCrop() → initialCropState
       ├─ CropWorkspace (dual panel, pan/zoom, keyboard)
       └─ exportCroppedImage() on accept → cropped/ subfolder
```

**Assessment:** Integration is coherent after QA fixes. Agent 1 (shell/routing), Agent 2 (crop UI + math), and Agent 3 (face detection + export) modules connect through `CropSession` as the orchestrator.

---

## Manual Browser Test Steps

> Requires **Chrome or Edge** (File System Access API). Use a folder with a few JPG/PNG test images.

1. **Start dev server**
   ```bash
   cd photo_cropper
   npm install
   npm run dev
   ```
   Open the URL shown (e.g. http://localhost:5174/).

2. **Step 1 — Dimensions**
   - Click a preset (e.g. **300×400**) or enter custom width/height and click **Użyj własnego wymiaru**.
   - Expect step indicator to advance to **2. Folder**.

3. **Step 2 — Folder**
   - Click **Wybierz folder**, pick a folder with images.
   - Grant read/write permission when prompted.
   - Expect transition to **3. Kadrowanie** with first image loaded.

4. **Step 3 — Crop workspace**
   - **Left panel:** full image with blue crop rectangle overlay.
   - **Right panel:** cropped preview at target aspect ratio.
   - **Drag** on right panel → crop shifts; **mouse wheel** → zoom.
   - **Arrow keys** → fine pan; **Enter/Space** → save & next; **Esc** → skip.

5. **Export verification**
   - Accept one image (OK or Enter).
   - In the source folder, confirm `cropped/` was created with the same filename.
   - Open exported file — dimensions should match chosen preset exactly.

6. **Face centering** (optional)
   - Use a portrait photo with a clear face.
   - On load, crop should shift toward face center (may take ~200–500 ms after model init).

7. **Small image upscale**
   - Use an image smaller than target dimensions (e.g. 200×200 with 300×400 target).
   - Exported file in `cropped/` should still be 300×400 px.

8. **Session end**
   - Skip or accept all images.
   - Expect completion screen with saved count and **Nowa sesja** / **Wybierz inny folder**.

9. **Cofnij**
   - After accepting 2+ images, click **Cofnij**.
   - Expect return to previous image in queue (note: previously exported file remains on disk).

---

## Summary

The Photo Cropper MVP is **functional and buildable** after resolving cross-agent integration issues. Core workflow (pick size → pick folder → review/adjust crop → export locally) matches the spec. Face detection via MediaPipe is integrated with a safe center fallback. Remaining gaps are minor UX/spec items (Backspace shortcut, nested folders, undo export) and deferred “later” features — none block basic usage in Chrome/Edge.

**Recommendation:** Proceed with manual browser testing using the steps above; prioritize verifying MediaPipe model load and export permissions on real folders.
