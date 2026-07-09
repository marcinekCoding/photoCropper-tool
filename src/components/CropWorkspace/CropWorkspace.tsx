import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  applyCropToCanvas,
  clampCropState,
  computeInitialCrop,
  cropRectToDisplayRect,
  getCropRect,
  computeImageDisplayLayout,
  displayDeltaToSourceDelta,
  clampScale,
  type Dimensions,
} from '../../lib/crop.ts';
import type { CropState, QueuedImage } from '../../types.ts';
import './CropWorkspace.css';

export type CropImageSource = File | string | QueuedImage;

export type MultiFaceStatus = 'ok' | 'warning' | 'none';

export interface CropWorkspaceProps {
  image: CropImageSource;
  targetDimensions: Dimensions;
  initialCropState?: CropState;
  multiFaceStatus?: MultiFaceStatus;
  onAccept: (cropState: CropState) => void;
  onSkip: () => void;
  /** Indeks bieżącego zdjęcia (0-based). */
  index: number;
  total: number;
  onBack?: () => void;
  savedCount?: number;
  /** True when revisiting an image that was already saved this session. */
  isResave?: boolean;
  isExporting?: boolean;
}

function resolveImageSource(image: CropImageSource): File | string {
  if (typeof image === 'string' || image instanceof File) {
    return image;
  }
  return image.file;
}

const FINE_PAN_STEP = 4;
const ZOOM_FACTOR = 1.08;

function useContainerSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const update = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

export function CropWorkspace({
  image,
  targetDimensions,
  initialCropState,
  multiFaceStatus = 'none',
  onAccept,
  onSkip,
  index,
  total,
  onBack,
  savedCount,
  isResave = false,
  isExporting = false,
}: CropWorkspaceProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<Dimensions | null>(null);
  const [cropState, setCropState] = useState<CropState>(
    initialCropState ?? computeInitialCrop(0, 0, targetDimensions.width, targetDimensions.height),
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragPanel, setDragPanel] = useState<'left' | 'right' | null>(null);

  const imageRef = useRef<HTMLImageElement>(null);
  const leftContainerRef = useRef<HTMLDivElement>(null);
  const rightContainerRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragPanelRef = useRef<'left' | 'right' | null>(null);
  const cropStateRef = useRef(cropState);

  const leftContainerSize = useContainerSize(leftContainerRef);

  cropStateRef.current = cropState;

  useEffect(() => {
    const source = resolveImageSource(image);
    let url: string;
    let revoke = false;

    if (typeof source === 'string') {
      url = source;
    } else {
      url = URL.createObjectURL(source);
      revoke = true;
    }

    setImageUrl(url);
    setImageSize(null);

    return () => {
      if (revoke) {
        URL.revokeObjectURL(url);
      }
    };
  }, [image]);

  useEffect(() => {
    if (!imageSize) {
      return;
    }
    setCropState((prev) =>
      clampCropState(imageSize.width, imageSize.height, targetDimensions, prev),
    );
  }, [imageSize, targetDimensions]);

  useEffect(() => {
    if (initialCropState && imageSize) {
      setCropState(
        clampCropState(
          imageSize.width,
          imageSize.height,
          targetDimensions,
          initialCropState,
        ),
      );
    }
  }, [initialCropState, imageSize, targetDimensions]);

  const updateCropState = useCallback(
    (updater: (prev: CropState) => CropState) => {
      if (!imageSize) {
        return;
      }
      setCropState((prev) =>
        clampCropState(
          imageSize.width,
          imageSize.height,
          targetDimensions,
          updater(prev),
        ),
      );
    },
    [imageSize, targetDimensions],
  );

  const renderPreview = useCallback(() => {
    const img = imageRef.current;
    const canvas = previewCanvasRef.current;
    if (!img || !canvas || !imageSize || !img.complete) {
      return;
    }

    const output = applyCropToCanvas(img, cropState, targetDimensions);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    canvas.width = output.width;
    canvas.height = output.height;
    ctx.drawImage(output, 0, 0);
  }, [cropState, imageSize, targetDimensions]);

  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  const handleImageLoad = () => {
    const img = imageRef.current;
    if (!img) {
      return;
    }
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    if (!initialCropState) {
      setCropState(
        computeInitialCrop(
          img.naturalWidth,
          img.naturalHeight,
          targetDimensions.width,
          targetDimensions.height,
        ),
      );
    }
    renderPreview();
  };

  const panBySourceDelta = useCallback(
    (deltaX: number, deltaY: number) => {
      updateCropState((prev) => ({
        ...prev,
        offsetX: prev.offsetX - deltaX,
        offsetY: prev.offsetY - deltaY,
      }));
    },
    [updateCropState],
  );

  const panByDisplayDelta = useCallback(
    (deltaDisplayX: number, deltaDisplayY: number) => {
      if (!imageSize) {
        return;
      }
      const rect = getCropRect(
        imageSize.width,
        imageSize.height,
        targetDimensions,
        cropStateRef.current,
      );
      const canvas = previewCanvasRef.current;
      const displayWidth = canvas?.clientWidth ?? targetDimensions.width;
      const displayHeight = canvas?.clientHeight ?? targetDimensions.height;
      const scaleX = rect.width / Math.max(displayWidth, 1);
      const scaleY = rect.height / Math.max(displayHeight, 1);
      panBySourceDelta(deltaDisplayX * scaleX, deltaDisplayY * scaleY);
    },
    [imageSize, targetDimensions, panBySourceDelta],
  );

  const panByLeftDisplayDelta = useCallback(
    (deltaDisplayX: number, deltaDisplayY: number) => {
      if (!imageSize || leftContainerSize.width === 0) {
        return;
      }
      const layout = computeImageDisplayLayout(
        imageSize.width,
        imageSize.height,
        leftContainerSize.width,
        leftContainerSize.height,
      );
      const deltaSourceX = displayDeltaToSourceDelta(deltaDisplayX, layout);
      const deltaSourceY = displayDeltaToSourceDelta(deltaDisplayY, layout);
      updateCropState((prev) => ({
        ...prev,
        offsetX: prev.offsetX + deltaSourceX,
        offsetY: prev.offsetY + deltaSourceY,
      }));
    },
    [imageSize, leftContainerSize, updateCropState],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      updateCropState((prev) => ({
        ...prev,
        scale: clampScale(prev.scale * factor),
      }));
    },
    [updateCropState],
  );

  const beginDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    panel: 'left' | 'right',
  ) => {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    dragPanelRef.current = panel;
    setDragPanel(panel);
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current || !dragPanelRef.current) {
      return;
    }
    const deltaX = event.clientX - dragStartRef.current.x;
    const deltaY = event.clientY - dragStartRef.current.y;
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    if (dragPanelRef.current === 'left') {
      panByLeftDisplayDelta(deltaX, deltaY);
    } else {
      panByDisplayDelta(deltaX, deltaY);
    }
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStartRef.current = null;
    dragPanelRef.current = null;
    setDragPanel(null);
    setIsDragging(false);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
    zoomBy(factor);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!imageSize) {
        return;
      }

      switch (event.key) {
        case ' ':
        case 'Enter':
          event.preventDefault();
          onAccept(cropStateRef.current);
          break;
        case 'Escape':
          event.preventDefault();
          onSkip();
          break;
        case 'Backspace':
          if (onBack) {
            event.preventDefault();
            onBack();
          }
          break;
        case 'ArrowLeft':
          event.preventDefault();
          panBySourceDelta(-FINE_PAN_STEP, 0);
          break;
        case 'ArrowRight':
          event.preventDefault();
          panBySourceDelta(FINE_PAN_STEP, 0);
          break;
        case 'ArrowUp':
          event.preventDefault();
          panBySourceDelta(0, -FINE_PAN_STEP);
          break;
        case 'ArrowDown':
          event.preventDefault();
          panBySourceDelta(0, FINE_PAN_STEP);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageSize, onAccept, onBack, onSkip, panBySourceDelta]);

  const overlayStyle: CSSProperties | undefined =
    imageSize && leftContainerSize.width > 0
      ? (() => {
          const layout = computeImageDisplayLayout(
            imageSize.width,
            imageSize.height,
            leftContainerSize.width,
            leftContainerSize.height,
          );
          const rect = getCropRect(
            imageSize.width,
            imageSize.height,
            targetDimensions,
            cropState,
          );
          const displayRect = cropRectToDisplayRect(rect, layout);
          return {
            left: displayRect.x,
            top: displayRect.y,
            width: displayRect.width,
            height: displayRect.height,
          };
        })()
      : undefined;

  const handleAccept = () => {
    onAccept(cropState);
  };

  const showFaceWarning = multiFaceStatus === 'warning';

  return (
    <div className="crop-workspace">
      <div className="crop-workspace__panels">
        <section className="crop-workspace__panel">
          <h2 className="crop-workspace__panel-title">Oryginał</h2>
          <div ref={leftContainerRef} className="crop-workspace__viewport">
            {!imageUrl ? (
              <span className="crop-workspace__loading">Ładowanie…</span>
            ) : (
              <>
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Oryginał"
                  className="crop-workspace__image"
                  onLoad={handleImageLoad}
                  draggable={false}
                />
                {overlayStyle && (
                  <div
                    className={`crop-workspace__overlay crop-workspace__overlay--interactive${
                      showFaceWarning ? ' crop-workspace__overlay--warning' : ''
                    }${isDragging && dragPanel === 'left' ? ' crop-workspace__overlay--dragging' : ''}`}
                    style={overlayStyle}
                    onPointerDown={(event) => beginDrag(event, 'left')}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  />
                )}
              </>
            )}
          </div>
          {showFaceWarning && (
            <p className="crop-workspace__warning-message">
              Nie wszystkie twarze mieszczą się w kadrze
            </p>
          )}
          <p className="crop-workspace__hint">Przeciągnij kadr aby przesunąć</p>
        </section>

        <section className="crop-workspace__panel">
          <h2 className="crop-workspace__panel-title">Skadrowane</h2>
          <div
            ref={rightContainerRef}
            className={`crop-workspace__viewport crop-workspace__viewport--interactive${
              isDragging && dragPanel === 'right' ? ' crop-workspace__viewport--dragging' : ''
            }${showFaceWarning ? ' crop-workspace__viewport--warning' : ''}`}
            onPointerDown={(event) => beginDrag(event, 'right')}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onWheel={handleWheel}
          >
            {!imageSize ? (
              <span className="crop-workspace__loading">Ładowanie…</span>
            ) : (
              <canvas
                ref={previewCanvasRef}
                className="crop-workspace__preview-canvas"
                style={{
                  aspectRatio: `${targetDimensions.width} / ${targetDimensions.height}`,
                }}
              />
            )}
          </div>
          <p className="crop-workspace__hint">
            Przeciągnij aby przesunąć · kółko myszy = zoom · strzałki = drobna korekta
          </p>
        </section>
      </div>

      <div className="crop-workspace__controls">
        {onBack && (
          <button
            type="button"
            className="crop-workspace__button"
            onClick={onBack}
            disabled={isExporting}
            title="Cofnij do poprzedniego zdjęcia (Backspace)"
          >
            Cofnij
          </button>
        )}
        <button
          type="button"
          className="crop-workspace__button"
          onClick={onSkip}
          disabled={isExporting}
        >
          Pomiń
        </button>
        <span className="crop-workspace__counter">
          {index + 1} / {total}
          {savedCount !== undefined ? ` · zapisane: ${savedCount}` : ''}
          {isExporting ? ' · zapisywanie…' : ''}
        </span>
        <button
          type="button"
          className="crop-workspace__button crop-workspace__button--primary"
          onClick={handleAccept}
          disabled={isExporting}
        >
          {isResave ? 'OK → nadpisz' : 'OK → następne'}
        </button>
      </div>
    </div>
  );
}
