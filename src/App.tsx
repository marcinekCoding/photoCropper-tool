import { lazy, Suspense } from 'react';
import { DimensionPicker } from './components/DimensionPicker';
import { FolderPicker } from './components/FolderPicker';
import { useSession } from './hooks/useSession';
import './App.css';

const CropSession = lazy(() =>
  import('./components/CropSession').then((module) => ({ default: module.CropSession })),
);

const STEPS = [
  { id: 'dimensions' as const, label: 'Format', number: 1 },
  { id: 'folder' as const, label: 'Folder', number: 2 },
  { id: 'crop' as const, label: 'Kadrowanie', number: 3 },
];

function CropIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M9 9h6v6H9z" />
      <path d="M3 9h3M18 9h3M9 3v3M9 18v3" />
    </svg>
  );
}

function LoadingPanel({ message }: { message: string }) {
  return (
    <div className="step-panel loading-panel" role="status" aria-live="polite">
      <div className="loading-spinner" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

function App() {
  const {
    state,
    setAspectRatio,
    setFolder,
    goToStep,
    acceptCurrent,
    skipCurrent,
    goBack,
    resetSession,
  } = useSession();

  const stepOrder = STEPS.map((s) => s.id);
  const currentStepIndex = stepOrder.indexOf(state.step);

  return (
    <div className={`app${state.step === 'crop' ? ' app--crop' : ''}`}>
      <header className="app-header">
        <div className="app-header__brand">
          <div className="app-header__logo">
            <CropIcon />
          </div>
          <h1>
            Photo <span className="text-highlight">Cropper</span>
          </h1>
        </div>
        <p className="app-subtitle">Masowe kadrowanie zdjęć — 100% lokalnie w przeglądarce</p>
        <ol className="step-indicator" aria-label="Kroki sesji">
          {STEPS.map((step) => {
            const stepIndex = stepOrder.indexOf(step.id);
            const isActive = state.step === step.id;
            const isDone = stepIndex < currentStepIndex;

            return (
              <li
                key={step.id}
                className={`step-indicator__item${isActive ? ' step-indicator__item--active' : ''}${isDone ? ' step-indicator__item--done' : ''}`}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className="step-indicator__dot" aria-hidden="true">
                  {isDone ? '✓' : step.number}
                </span>
                <span className="step-indicator__label">{step.label}</span>
              </li>
            );
          })}
        </ol>
      </header>

      <main className="app-main">
        {state.step === 'dimensions' && <DimensionPicker onSelect={setAspectRatio} />}

        {state.step === 'folder' && state.aspectRatio && (
          <FolderPicker
            aspectRatio={state.aspectRatio}
            onSelect={setFolder}
            onBack={() => goToStep('dimensions')}
          />
        )}

        {state.step === 'crop' && state.aspectRatio && state.directoryHandle && (
          <Suspense fallback={<LoadingPanel message="Ładowanie narzędzi kadrowania…" />}>
            <CropSession
              aspectRatio={state.aspectRatio}
              directoryHandle={state.directoryHandle}
              queue={state.queue}
              currentIndex={state.currentIndex}
              savedCount={state.savedCount}
              savedCrops={state.savedCrops}
              onAccept={acceptCurrent}
              onSkip={skipCurrent}
              onBack={goBack}
              onRestart={resetSession}
              onChangeFolder={() => goToStep('folder')}
            />
          </Suspense>
        )}
      </main>
    </div>
  );
}

export default App;
