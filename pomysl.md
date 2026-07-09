# Photo Cropper — pomysł i stan implementacji

> **Ostatnia aktualizacja dokumentu:** 2026-07-09  
> **Stan:** MVP zaimplementowane — aplikacja działa lokalnie w Chrome/Edge.

---

## Problem

Masowe kadrowanie zdjęć do stałego wymiaru jest żmudne w zwykłych edytorach. Trzeba otwierać każde zdjęcie osobno, ustawiać kadrowanie ręcznie i zapisywać. Przy setkach zdjęć (np. materiał do montażu wideo, wstawianie w szablony) to zajmuje godziny.

## Cel

Narzędzie webowe do **szybkiego, masowego kadrowania** zdjęć z minimalną liczbą kliknięć — działające **w pełni offline** w przeglądarce (prywatność, brak wysyłania plików do chmury).

### Kontekst użycia

Zdjęcia po przetworzeniu będą wykorzystywane do:
- **montażu filmów** — jednolite kadry, stałe proporcje, szybkie wstawianie na timeline
- **wstawiania w szablony** — np. ramki, kolaże, slajdy z wymaganym formatem

Dlatego ważne są: powtarzalny wymiar, szybkość obiegu i przewidywalne centrowanie (twarz w tym samym miejscu w kadrze).

### Wymagania platformy

- **100% lokalnie** — przetwarzanie w przeglądarce, bez uploadu
- **Chrome / Edge** — File System Access API + MediaPipe WASM
- **Offline** — model twarzy i aplikacja serwowane lokalnie (PWA opcjonalnie — patrz sekcja „Później”)

---

## Główny przepływ (zrealizowany)

1. **Wybór wymiaru** — graficzne karty presetów lub własny rozmiar przez przeciąganie krawędzi ramki.
2. **Wybór folderu** — wczytanie wszystkich zdjęć JPG/PNG/WebP z wybranego folderu.
3. **Kadrowanie** — kolejka zdjęć z podglądem dwupanelowym, propozycją algorytmu twarzy i ręczną korektą.
4. **Eksport** — zapis do podfolderu `cropped/` w folderze źródłowym, te same nazwy plików.

---

## Stan implementacji

### Stack technologiczny ✅

| Warstwa | Technologia | Status |
|--------|-------------|--------|
| UI | React 19 + TypeScript | ✅ |
| Build | Vite 7 | ✅ |
| Kadrowanie / canvas | HTML Canvas (`lib/crop.ts`) | ✅ |
| Wykrywanie twarzy | MediaPipe Face Detection (WASM, `/public/mediapipe/`) | ✅ |
| Eksport plików | File System Access API → `cropped/` | ✅ |
| Offline / PWA | Cache modelu lokalnie; brak manifestu PWA | ⚠️ częściowo |

### MVP — zrealizowane ✅

- [x] **Vite + React + TypeScript** — pełny stack (`App.tsx`, `main.tsx`, `package.json`)
- [x] **3-krokowy przepływ:** wymiar → folder → kadrowanie (`useSession.ts`, wskaźnik kroków w nagłówku)
- [x] **Graficzny wybór presetów** — karty wizualne z proporcjami (`DimensionPicker.tsx`):
  - Portret (300×400, 3:4)
  - Panorama (1920×1080, 16:9)
  - Kwadrat (1:1, 1080×1080)
  - Klasyczny (4:3, 1600×1200)
  - Story (9:16, 1080×1920)
- [x] **Własny wymiar — graficznie** — ramka z uchwytami N/S/E/W, przeciąganie krawędzi (bez pól tekstowych); zakres 100–4000 px
- [x] **Wybór folderu źródłowego** — `showDirectoryPicker`, JPG/PNG/WebP (`FolderPicker.tsx`)
- [x] **Interfejs dwupanelowy** — oryginał lewo, skadrowany podgląd prawo (`CropWorkspace.tsx`)
- [x] **Przeciągalna ramka kadru na LEWYM panelu** — synchronizacja z podglądem po prawej
- [x] **Pan + zoom na PRAWYM panelu** — przeciąganie + kółko myszy (zoom 1×–8×)
- [x] **Kolejka zdjęć z licznikiem** — np. `12 / 87 · zapisane: 11`
- [x] **MediaPipe — auto-centrowanie twarzy** — tylko przesunięcie, **bez skalowania** (`faceDetection.ts`, `CropSession.tsx`)
- [x] **Wiele twarzy** — próba zmieszczenia WSZYSTKICH twarzy w kadrze; żółta przerywana ramka + komunikat gdy się nie da (`proposeCropFromFaceBoxes`)
- [x] **Powiększanie małych zdjęć** — `applyCropToCanvas` zawsze renderuje do docelowego wymiaru (upscale przy eksporcie)
- [x] **Eksport do `cropped/`** — podfolder w folderze źródłowym, te same nazwy plików (`export.ts`)
- [x] **Skróty klawiszowe:**
  - `Enter` / `Spacja` — zapisz i następne
  - `Esc` — pomiń
  - `Backspace` — cofnij do poprzedniego zdjęcia
  - strzałki — drobne przesunięcie kadru
  - kółko myszy — zoom (panel prawy)
- [x] **Cofnij + nadpisanie** — powrót do poprzedniego zdjęcia; ponowne OK **nadpisuje** plik w `cropped/` (`savedCrops` w `useSession.ts`, `keepExistingData: false` w eksporcie)
- [x] **100% lokalne przetwarzanie** — bez wysyłania danych na serwer

### MVP — jeszcze niezrealizowane ⚠️

- [ ] **Skanowanie zagnieżdżonych podfolderów** — obecnie tylko pliki w katalogu głównym wybranego folderu
- [ ] **PWA** — manifest, service worker, instalacja offline
- [ ] **Batch auto-accept** — „zatwierdź wszystkie z dobrą propozycją”
- [ ] **EXIF: auto-obrót** przed kadrowaniem
- [ ] **Zapisane własne presety** użytkownika (np. „szablon A”)
- [ ] **Konfigurowalna nazwa podfolderu** wyjściowego (obecnie stałe `cropped/`)
- [ ] **Eksport z ustawioną jakością / formatem**
- [ ] **Metadane eksportu** (numeracja, prefiks plików)
- [ ] **Lepszy upscale** — opcjonalnie algorytm wykraczający poza interpolację canvas

---

## Chronologia życzeń użytkownika

Krótka historia decyzji i zmian w trakcie rozmowy / implementacji:

1. **Pomysł początkowy** — wybór wymiaru, masowy folder, klikanie przez kolejkę, algorytm twarzy jako propozycja (ręczna korekta zawsze).
2. **Eksport do podfolderu** — `cropped/` w folderze źródłowym, oryginały nietknięte, te same nazwy.
3. **Twarz: tylko centrowanie** — bez skalowania kadru do twarzy; zoom tylko ręcznie.
4. **Małe zdjęcia** — upscale do wybranego wymiaru przy zapisie (użytkownik i tak widzi każde zdjęcie).
5. **UI dwupanelowy** — oryginał lewo, skadrowany wynik prawo; pan + zoom na prawym panelu.
6. **Graficzne presety** — karty wizualne z proporcjami (nie same liczby w liście).
7. **Własny wymiar graficznie** — przeciąganie krawędzi ramki (N/S/E/W), nie inputy tekstowe.
8. **Wiele twarzy** — próba zmieszczenia wszystkich; żółta przerywana ramka ostrzegawcza gdy się nie da.
9. **Przeciągalna ramka na lewym panelu** — przesuwanie kadru na oryginale synchronizuje podgląd po prawej.
10. **Cofnij + nadpisanie** — powrót do poprzedniego zdjęcia; ponowny zapis nadpisuje plik w `cropped/`.

---

## Przepływ użytkownika (aktualny)

```
[Krok 1: Wybór wymiaru]
   → kliknij kartę presetu (Portret / Panorama / Kwadrat / Klasyczny / Story)
   LUB przeciągnij krawędzie ramki własnego wymiaru → „Użyj tego wymiaru”
        ↓
[Krok 2: Wybór folderu]
   → Chrome/Edge: showDirectoryPicker (readwrite)
   → wczytanie JPG, PNG, WebP z folderu głównego
        ↓
[Krok 3: Kadrowanie — dla każdego zdjęcia]
   LEWO:  pełny oryginał + przeciągalna ramka kadru (overlay)
   PRAWO: podgląd wyniku w wybranym wymiarze (canvas)
   AUTO:  MediaPipe → centruj twarz (1 twarz) lub zmieść wszystkie (wiele twarzy)
          → żółta ramka jeśli nie wszystkie twarze mieszczą się w kadrze
   RĘCZNIE:
          lewy panel — przeciągnij ramkę kadru
          prawy panel — przeciągnij (pan) + kółko myszy (zoom)
        ↓
   Enter / Spacja  = zapisz do cropped/ i następne
   Esc             = pomiń (bez zapisu)
   Backspace       = cofnij do poprzedniego (ponowne OK nadpisuje plik)
   Strzałki        = drobna korekta pozycji
        ↓
[Koniec sesji]
   → podsumowanie · wybierz inny folder · nowa sesja
```

### Przykład sesji

```
/Users/ja/Zdjecia/sesja_2024/
├── IMG_001.jpg          ← oryginał (bez zmian)
├── IMG_002.jpg
├── IMG_003.jpg
└── cropped/             ← tworzony przez aplikację
    ├── IMG_001.jpg      ← wycięte do wybranego wymiaru
    ├── IMG_002.jpg
    └── IMG_003.jpg
```

---

## Interfejs (UI) — zaimplementowany

```
┌─────────────────────────┬─────────────────────────┐
│      ORYGINAŁ           │      SKADROWANE         │
│                         │                         │
│   Pełne zdjęcie         │   Podgląd wyniku        │
│   + ramka kadru         │   w wybranym wymiarze   │
│   (przeciągalna)        │   (pan + zoom)          │
│                         │                         │
│   [żółta ramka gdy      │                         │
│    multi-face warning]  │                         │
└─────────────────────────┴─────────────────────────┘
   [ Cofnij ]  [ Pomiń ]     12 / 87 · zapisane: 11
                        [ OK → następne ]
```

### Krok 1 — wybór wymiaru (`DimensionPicker.tsx`)

- Siatka kart presetów z kształtem proporcjonalnym, tytułem i rozmiarem w px.
- Sekcja „Lub własny wymiar” — interaktywna ramka z uchwytami na krawędziach (N, S, E, W).
- Wyświetlanie bieżącego rozmiaru na żywo; przycisk „Użyj tego wymiaru”.

### Krok 3 — kadrowanie (`CropWorkspace.tsx`)

- **Panel lewy:** pełny obraz + overlay ramki zsynchronizowany z kadrem; przeciąganie przesuwa kadr.
- **Panel prawy:** canvas z podglądem wyniku; przeciąganie = pan, kółko = zoom.
- **Ostrzeżenie multi-face:** żółta przerywana ramka + tekst „Nie wszystkie twarze mieszczą się w kadrze”.
- Proporcje kadru wyjściowego **stałe** przez całą sesję — zoom zmienia powiększenie wewnątrz kadru, nie proporcje ramki.

---

## Algorytm twarzy — zaimplementowany

**Biblioteka:** MediaPipe Face Detection (`@mediapipe/face_detection`), model `short`, WASM z `/mediapipe/face_detection/`.

**Zasada: centruj, nie skaluj.** Kadr ma stały wymiar sesji — algorytm tylko przesuwa `offsetX`/`offsetY`, `scale` pozostaje 1 (chyba że użytkownik zoomuje ręcznie).

**Logika (`faceDetection.ts` → `proposeCropFromFaceBoxes`):**

| Sytuacja | Zachowanie |
|----------|------------|
| Brak twarzy | Kadr wyśrodkowany na środku zdjęcia |
| 1 twarz | Centrum kadru = centrum twarzy |
| Wiele twarzy | Próba zmieszczenia wszystkich bboxów (z marginesem 15%) w kadrze przy scale=1 |
| Wiele twarzy — nie da się | Best-effort centrowanie grupy + `multiFaceStatus: 'warning'` (żółta ramka) |

**Czego algorytm NIE robi:**
- Nie zoomuje kadru na twarz.
- Nie dopasowuje rozmiaru kadru do wielkości twarzy.
- Nie zapisuje automatycznie — zawsze wymaga OK użytkownika.

---

## Zdjęcia mniejsze niż wybrany kadr

Każde zdjęcie przechodzi **ręczny przegląd**. Gdy źródło jest mniejsze niż docelowy kadr:

1. Wycięty fragment jest **skalowany w górę** do wybranego wymiaru (`applyCropToCanvas` → `canvas.width/height = target`).
2. Podgląd (panel prawy) pokazuje finalny efekt przed zapisem.
3. Upscale to osobna operacja od algorytmu twarzy — twarz nadal tylko centruje, nie zoomuje.

---

## Cofnij i nadpisanie

- Przycisk **Cofnij** lub `Backspace` — `currentIndex` maleje o 1 (`useSession.goBack`).
- Przy powrocie do wcześniej zapisanego zdjęcia przywracany jest ostatni `cropState` z `savedCrops`.
- Ponowne **OK** wywołuje `exportCroppedImage` z `keepExistingData: false` — plik w `cropped/` jest **nadpisywany**.
- Licznik „zapisane” nie rośnie przy ponownym zapisie tego samego pliku (`isResave` w `acceptCurrent`).

---

## Eksport — folder wyjściowy

- Użytkownik wybiera folder źródłowy z uprawnieniem **readwrite**.
- Aplikacja tworzy `cropped/` wewnątrz tego folderu (`ensureOutputDirectory`).
- Nazwy plików: **identyczne** jak oryginały — łatwe parowanie.
- Format wyjściowy: ten sam co źródło (JPEG quality 0.92, PNG/WebP bezstratnie).

---

## Jak uruchomić

```bash
cd photo_cropper
npm install
npm run dev
```

Otwórz w **Chrome** lub **Edge** (np. `http://localhost:5173`).

Build produkcyjny:

```bash
npm run build
npm run preview
```

---

## Struktura kodu (kluczowe pliki)

| Plik | Odpowiedzialność |
|------|------------------|
| `src/App.tsx` | 3-krokowy przepływ, lazy-load `CropSession` |
| `src/hooks/useSession.ts` | Stan sesji, kolejka, cofnij, savedCrops |
| `src/components/DimensionPicker.tsx` | Presety + resizable frame |
| `src/components/FolderPicker.tsx` | Wybór folderu, skanowanie plików |
| `src/components/CropSession.tsx` | MediaPipe, eksport per zdjęcie |
| `src/components/CropWorkspace/CropWorkspace.tsx` | UI dwupanelowy, skróty, drag |
| `src/lib/faceDetection.ts` | MediaPipe, multi-face logic |
| `src/lib/crop.ts` | Matematyka kadru, canvas, upscale |
| `src/lib/export.ts` | Zapis do `cropped/` |
| `src/types.ts` | Presety, typy sesji, rozszerzenia plików |

---

## Wymagania niefunkcjonalne

- **Prywatność:** zdjęcia nie opuszczają urządzenia. ✅
- **Szybkość:** przejście OK → następne bez zbędnych opóźnień (model ładowany raz). ✅
- **Powtarzalność:** ten sam wymiar i logika kadru dla całej sesji. ✅

---

## Otwarte kwestie

- Konkretne presety pod konkretny szablon montażowy — obecnie uniwersalne 5 formatów + własny.
- Nazwa podfolderu — stała `cropped/` czy z sufiksem wymiaru (np. `cropped_300x400/`)?
- Jakość upscale — obecnie `imageSmoothingQuality: 'high'` na canvas; czy wystarczy?

---

## Notatki

- **Data utworzenia pomysłu:** 2026-07-09
- **Data ukończenia MVP:** 2026-07-09
- **Decyzje:** web, offline, presety graficzne + własny wymiar przez ramkę, twarz = propozycja (ręczna korekta zawsze)
- **Use case:** montaż wideo + szablony
- **Eksport:** `cropped/` w folderze źródłowym, te same nazwy plików
- **Twarz:** auto centruje (1 twarz) lub mieści wszystkie (wiele); ręcznie — pan/zoom na obu panelach
- **UI:** oryginał lewo (przeciągalna ramka), skadrowany podgląd prawo (pan + zoom)
- **Małe zdjęcia:** upscale do wybranego wymiaru przy zapisie
- **Cofnij:** Backspace lub przycisk; ponowny zapis nadpisuje plik w `cropped/`
