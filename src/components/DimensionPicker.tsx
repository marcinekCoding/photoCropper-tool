import { useCallback, useRef, useState } from 'react';
import type { CropAspectRatio } from '../types';
import { ASPECT_PRESETS, formatAspectRatio } from '../types';

interface DimensionPickerProps {
  onSelect: (aspectRatio: CropAspectRatio) => void;
}

const MIN_RATIO = 1;
const MAX_RATIO = 32;
const MIN_VISUAL = 56;
const MAX_VISUAL_W = 300;
const MAX_VISUAL_H = 210;

interface VisualSize {
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/** Najbliższa "ładna" proporcja (małe liczby całkowite) dla dowolnego prostokąta. */
function approximateRatio(width: number, height: number): { rw: number; rh: number } {
  const target = width / height;
  let best = { rw: 1, rh: 1, err: Math.abs(target - 1) };

  for (let rh = 1; rh <= MAX_RATIO; rh++) {
    const rw = clamp(Math.round(target * rh), MIN_RATIO, MAX_RATIO);
    const err = Math.abs(target - rw / rh);
    if (err < best.err - 1e-9) {
      best = { rw, rh, err };
    }
  }

  const g = gcd(best.rw, best.rh);
  return { rw: best.rw / g, rh: best.rh / g };
}

/** Rozmiar podglądu ramki dla danej proporcji. */
function ratioToVisual(rw: number, rh: number): VisualSize {
  const scale = Math.min(MAX_VISUAL_W / rw, MAX_VISUAL_H / rh);
  return {
    width: Math.max(MIN_VISUAL, rw * scale),
    height: Math.max(MIN_VISUAL, rh * scale),
  };
}

function PresetShape({ ratioW, ratioH }: { ratioW: number; ratioH: number }) {
  const isLandscape = ratioW >= ratioH;

  return (
    <div className="preset-visual" aria-hidden="true">
      <div
        className={`preset-shape ${isLandscape ? 'preset-shape--landscape' : 'preset-shape--portrait'}`}
        style={{ aspectRatio: `${ratioW} / ${ratioH}` }}
      />
    </div>
  );
}

export function DimensionPicker({ onSelect }: DimensionPickerProps) {
  const [ratioW, setRatioW] = useState(4);
  const [ratioH, setRatioH] = useState(3);
  const [visual, setVisual] = useState<VisualSize>(() => ratioToVisual(4, 3));
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  const applyVisual = useCallback((width: number, height: number) => {
    const w = clamp(width, MIN_VISUAL, MAX_VISUAL_W);
    const h = clamp(height, MIN_VISUAL, MAX_VISUAL_H);
    setVisual({ width: w, height: h });
    const { rw, rh } = approximateRatio(w, h);
    setRatioW(rw);
    setRatioH(rh);
    setSelectedLabel(null);
  }, []);

  const handleCornerPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        startWidth: visual.width,
        startHeight: visual.height,
      };
      setIsDragging(true);
    },
    [visual],
  );

  const handleCornerPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      const { startX, startY, startWidth, startHeight } = dragRef.current;
      applyVisual(
        startWidth + (event.clientX - startX),
        startHeight + (event.clientY - startY),
      );
    },
    [applyVisual],
  );

  const handleCornerPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      dragRef.current = null;
      setIsDragging(false);
    },
    [],
  );

  const handleRatioInput = (axis: 'w' | 'h') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = clamp(Math.round(Number(event.target.value) || MIN_RATIO), MIN_RATIO, MAX_RATIO);
    const nextW = axis === 'w' ? value : ratioW;
    const nextH = axis === 'h' ? value : ratioH;
    setRatioW(nextW);
    setRatioH(nextH);
    setVisual(ratioToVisual(nextW, nextH));
    setSelectedLabel(null);
  };

  const handlePresetSelect = (preset: CropAspectRatio) => {
    setSelectedLabel(preset.label);
    onSelect(preset);
  };

  const handleCustomSubmit = () => {
    const label = formatAspectRatio(ratioW, ratioH);
    setSelectedLabel(null);
    onSelect({
      ratioW,
      ratioH,
      label: `Własny ${label}`,
    });
  };

  return (
    <section className="step-panel">
      <h2>Krok 1: Wybierz format kadru</h2>
      <p className="step-description">
        Wybierz proporcje zdjęcia. Rozdzielczość każdego pliku zostaje zachowana — eksport bez
        skalowania do sztywnych pikseli.
      </p>

      <p className="preset-section-label">Gotowe proporcje</p>
      <div className="preset-grid" role="listbox" aria-label="Gotowe proporcje kadru">
        {ASPECT_PRESETS.map((preset) => {
          const isSelected = selectedLabel === preset.label;

          return (
            <button
              key={preset.label}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`preset-card${isSelected ? ' preset-card--selected' : ''}`}
              onClick={() => handlePresetSelect(preset)}
            >
              <PresetShape ratioW={preset.ratioW} ratioH={preset.ratioH} />
              <span className="preset-card__title">{preset.label}</span>
              <span className="preset-card__ratio">
                {formatAspectRatio(preset.ratioW, preset.ratioH)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="custom-dimensions">
        <h3>Lub własna proporcja</h3>
        <p className="custom-dimensions__hint">
          Złap narożnik ramki i rozciągnij ją do dowolnego kształtu — albo wpisz proporcję ręcznie.
        </p>

        <div className="custom-dimension-workspace">
          <div
            className="custom-dimension-frame-area"
            aria-label={`Podgląd proporcji ${formatAspectRatio(ratioW, ratioH)}`}
          >
            <div
              className={`custom-dimension-frame${isDragging ? ' custom-dimension-frame--dragging' : ''}`}
              style={{ width: visual.width, height: visual.height }}
            >
              <div className="custom-dimension-frame__inner" aria-hidden="true">
                <span className="custom-dimension-frame__ratio-badge">
                  {formatAspectRatio(ratioW, ratioH)}
                </span>
              </div>

              <div
                role="slider"
                aria-label="Narożnik ramki — rozciągnij, aby zmienić proporcje"
                className="custom-dimension-frame__corner"
                onPointerDown={handleCornerPointerDown}
                onPointerMove={handleCornerPointerMove}
                onPointerUp={handleCornerPointerUp}
                onPointerCancel={handleCornerPointerUp}
              />
            </div>
          </div>
        </div>

        <div className="custom-ratio-inputs">
          <label className="custom-ratio-inputs__field">
            <span>Szerokość</span>
            <input
              type="number"
              min={MIN_RATIO}
              max={MAX_RATIO}
              value={ratioW}
              onChange={handleRatioInput('w')}
            />
          </label>
          <span className="custom-ratio-inputs__separator" aria-hidden="true">
            :
          </span>
          <label className="custom-ratio-inputs__field">
            <span>Wysokość</span>
            <input
              type="number"
              min={MIN_RATIO}
              max={MAX_RATIO}
              value={ratioH}
              onChange={handleRatioInput('h')}
            />
          </label>
        </div>

        <button type="button" className="primary-button custom-dimension-confirm" onClick={handleCustomSubmit}>
          Użyj proporcji {formatAspectRatio(ratioW, ratioH)}
        </button>
      </div>
    </section>
  );
}
