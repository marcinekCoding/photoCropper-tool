import { lazy, Suspense } from 'react';
import { DimensionPicker } from './components/DimensionPicker';
import { FolderPicker } from './components/FolderPicker';
import { useSession } from './hooks/useSession';
import './App.css';

const CropSession = lazy(() =>
  import('./components/CropSession').then((module) => ({ default: module.CropSession })),
);

function App() {
  const {
    state,
    setDimensions,
    setFolder,
    goToStep,
    acceptCurrent,
    skipCurrent,
    goBack,
    resetSession,
  } = useSession();

  return (
    <div className="app">
      <header className="app-header">
        <h1>Photo Cropper</h1>
        <p className="app-subtitle">Masowe kadrowanie zdjęć — 100% lokalnie w przeglądarce</p>
        <nav className="step-indicator" aria-label="Kroki sesji">
          <span className={state.step === 'dimensions' ? 'active' : ''}>1. Wymiar</span>
          <span className={state.step === 'folder' ? 'active' : ''}>2. Folder</span>
          <span className={state.step === 'crop' ? 'active' : ''}>3. Kadrowanie</span>
        </nav>
      </header>

      <main className="app-main">
        {state.step === 'dimensions' && <DimensionPicker onSelect={setDimensions} />}

        {state.step === 'folder' && state.dimensions && (
          <FolderPicker
            dimensions={state.dimensions}
            onSelect={setFolder}
            onBack={() => goToStep('dimensions')}
          />
        )}

        {state.step === 'crop' && state.dimensions && state.directoryHandle && (
          <Suspense fallback={<p className="step-description">Ładowanie narzędzi kadrowania…</p>}>
            <CropSession
              dimensions={state.dimensions}
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
