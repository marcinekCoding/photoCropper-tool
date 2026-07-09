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
    setAspectRatio,
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
          <span className={state.step === 'dimensions' ? 'active' : ''}>1. Format</span>
          <span className={state.step === 'folder' ? 'active' : ''}>2. Folder</span>
          <span className={state.step === 'crop' ? 'active' : ''}>3. Kadrowanie</span>
        </nav>
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
          <Suspense fallback={<p className="step-description">Ładowanie narzędzi kadrowania…</p>}>
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
