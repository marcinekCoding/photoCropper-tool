import { useCallback, useRef, useState } from 'react';
import type { CropDimensions } from '../types';
import { DIMENSION_PRESETS } from '../types';

interface DimensionPickerProps {
  onSelect: (dimensions: CropDimensions) => void;
}

const PRESET_HINTS: Record<string, { title: string; subtitle: string }> = {
  '300×400': { title: 'Portret', subtitle: '3:4' },
  '1920×1080': { title: 'Panorama', subtitle: '16:9' },
  '1:1': { title: 'Kwadrat', subtitle: '1:1' },
  '4:3': { title: 'Klasyczny', subtitle: '4:3' },
  '9:16': { title: 'Story', subtitle: '9:16' },
};

const MIN_DIMENSION = 100;
const MAX_DIMENSION = 4000;
const PREVIEW_MAX_WIDTH = 280;
const PREVIEW_MAX_HEIGHT = 200;
const DRAG_SENSITIVITY = (MAX_DIMENSION - MIN_DIMENSION) / 200;

type FrameEdge = 'n' | 's' | 'e' | 'w';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getVisualFrameSize(width: number, height: number): { visualWidth: number; visualHeight: number } {
  const scale = Math.min(PREVIEW_MAX_WIDTH / width, PREVIEW_MAX_HEIGHT / height);
  return {
    visualWidth: width * scale,
    visualHeight: height * scale,
  };
}

function PresetShape({ width, height }: { width: number; height: number }) {
  const isLandscape = width >= height;

  return (
    <div className="preset-visual" aria-hidden="true">
      <div
        className={`preset-shape ${isLandscape ? 'preset-shape--landscape' : 'preset-shape--portrait'}`}
        style={{ aspectRatio: `${width} / ${height}` }}
      />
    </div>
  );
}

interface ResizableFrameProps {
  width: number;
  height: number;
  onResizeStart: () => void;
  onResize: (edge: FrameEdge, deltaX: number, deltaY: number) => void;
  onResizeEnd: () => void;
  isDragging: boolean;
}

function ResizableFrame({ width, height, onResizeStart, onResize, onResizeEnd, isDragging }: ResizableFrameProps) {
  const dragRef = useRef<{ edge: FrameEdge; startX: number; startY: number } | null>(null);
  const { visualWidth, visualHeight } = getVisualFrameSize(width, height);

  const handlePointerDown = useCallback(
    (edge: FrameEdge) => (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { edge, startX: event.clientX, startY: event.clientY };
      onResizeStart();
    },
    [onResizeStart],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      const { edge, startX, startY } = dragRef.current;
      onResize(edge, event.clientX - startX, event.clientY - startY);
    },
    [onResize],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      dragRef.current = null;
      onResizeEnd();
    },
    [onResizeEnd],
  );

  const edges: { edge: FrameEdge; className: string; label: string }[] = [
    { edge: 'n', className: 'custom-dimension-frame__handle--n', label: 'Górna krawędź — wysokość' },
    { edge: 's', className: 'custom-dimension-frame__handle--s', label: 'Dolna krawędź — wysokość' },
    { edge: 'e', className: 'custom-dimension-frame__handle--e', label: 'Prawa krawędź — szerokość' },
    { edge: 'w', className: 'custom-dimension-frame__handle--w', label: 'Lewa krawędź — szerokość' },
  ];

  return (
    <div
      className="custom-dimension-frame-area"
      aria-label={`Podgląd kadru ${width} na ${height} pikseli`}
    >
      <div
        className={`custom-dimension-frame${isDragging ? ' custom-dimension-frame--dragging' : ''}`}
        style={{ width: visualWidth, height: visualHeight }}
      >
        <div className="custom-dimension-frame__inner" aria-hidden="true">
          <span className="custom-dimension-frame__icon" aria-hidden="true">
            🖼
          </span>
        </div>

        {edges.map(({ edge, className, label }) => (
          <div
            key={edge}
            role="slider"
            aria-label={label}
            aria-valuemin={MIN_DIMENSION}
            aria-valuemax={MAX_DIMENSION}
            aria-valuenow={edge === 'e' || edge === 'w' ? width : height}
            aria-valuetext={
              edge === 'e' || edge === 'w'
                ? `${width} pikseli szerokości`
                : `${height} pikseli wysokości`
            }
            className={`custom-dimension-frame__handle ${className}`}
            onPointerDown={handlePointerDown(edge)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        ))}
      </div>
    </div>
  );
}

export function DimensionPicker({ onSelect }: DimensionPickerProps) {
  const [customWidth, setCustomWidth] = useState(800);
  const [customHeight, setCustomHeight] = useState(600);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const resizeStartRef = useRef<{ width: number; height: number }>({ width: 800, height: 600 });

  const handleResizeStart = useCallback(() => {
    resizeStartRef.current = { width: customWidth, height: customHeight };
    setIsDragging(true);
  }, [customWidth, customHeight]);

  const handleResize = useCallback((edge: FrameEdge, deltaX: number, deltaY: number) => {
    const { width: startWidth, height: startHeight } = resizeStartRef.current;

    if (edge === 'e') {
      setCustomWidth(clamp(Math.round(startWidth + deltaX * DRAG_SENSITIVITY), MIN_DIMENSION, MAX_DIMENSION));
    } else if (edge === 'w') {
      setCustomWidth(clamp(Math.round(startWidth - deltaX * DRAG_SENSITIVITY), MIN_DIMENSION, MAX_DIMENSION));
    } else if (edge === 's') {
      setCustomHeight(clamp(Math.round(startHeight + deltaY * DRAG_SENSITIVITY), MIN_DIMENSION, MAX_DIMENSION));
    } else if (edge === 'n') {
      setCustomHeight(clamp(Math.round(startHeight - deltaY * DRAG_SENSITIVITY), MIN_DIMENSION, MAX_DIMENSION));
    }

    setSelectedLabel(null);
  }, []);

  const handleResizeEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handlePresetSelect = (preset: CropDimensions) => {
    setSelectedLabel(preset.label);
    onSelect(preset);
  };

  const handleCustomSubmit = () => {
    setSelectedLabel(null);
    onSelect({
      width: customWidth,
      height: customHeight,
      label: `${customWidth}×${customHeight}`,
    });
  };

  return (
    <section className="step-panel">
      <h2>Krok 1: Wybierz wymiar kadru</h2>
      <p className="step-description">
        Wybierz gotowy format lub podaj własny rozmiar wyjściowy dla całej sesji kadrowania.
      </p>

      <p className="preset-section-label">Gotowe formaty</p>
      <div className="preset-grid" role="listbox" aria-label="Gotowe formaty kadru">
        {DIMENSION_PRESETS.map((preset) => {
          const hint = PRESET_HINTS[preset.label];
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
              <PresetShape width={preset.width} height={preset.height} />
              <span className="preset-card__title">{hint?.title ?? preset.label}</span>
              <span className="preset-card__ratio">{hint?.subtitle ?? preset.label}</span>
              <span className="preset-card__size">
                {preset.width} × {preset.height} px
              </span>
            </button>
          );
        })}
      </div>

      <div className="custom-dimensions">
        <h3>Lub własny wymiar</h3>
        <p className="custom-dimensions__hint">
          Chwyć krawędź i przeciągnij, aby zmienić wymiar ({MIN_DIMENSION}–{MAX_DIMENSION} px).
        </p>

        <div className="custom-dimension-workspace">
          <ResizableFrame
            width={customWidth}
            height={customHeight}
            onResizeStart={handleResizeStart}
            onResize={handleResize}
            onResizeEnd={handleResizeEnd}
            isDragging={isDragging}
          />
        </div>

        <p className="custom-dimension-display" aria-live="polite">
          <span className="custom-dimension-display__value">
            {customWidth} × {customHeight} px
          </span>
        </p>

        <button type="button" className="primary-button custom-dimension-confirm" onClick={handleCustomSubmit}>
          Użyj tego wymiaru
        </button>
      </div>
    </section>
  );
}
