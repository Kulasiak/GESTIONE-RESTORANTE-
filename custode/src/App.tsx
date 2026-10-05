import { lazy, Suspense } from 'react';
import { useApp } from './state';
import { TabBar, Toast } from './components/ui';
import { AlertSheet } from './components/AlertSheet';
import { Welcome, RoleSetup } from './screens/Onboarding';
import { Scan } from './screens/Scan';
import { Today } from './screens/Today';
import { Docs, DocDetail, AddDoc } from './screens/Docs';
import { Lost } from './screens/Lost';
import { Places, Museum } from './screens/Places';
import { Transfer } from './screens/Transfer';
import { Sos } from './screens/Sos';
import { Settings } from './screens/Settings';

// La mappa (Leaflet) e l'editor si caricano solo quando servono
const MapScreen = lazy(() => import('./screens/MapScreen'));
const Editor = lazy(() => import('./screens/Editor'));

export default function App() {
  const { nav, t, online } = useApp();
  let body: React.ReactNode;
  if (nav.screen === 'welcome') body = <Welcome />;
  else if (nav.screen === 'role') body = <RoleSetup />;
  else if (nav.screen === 'scan') body = <Scan onboarding />;
  else {
    const sub = nav.sub;
    const page =
      sub === 'transfer' ? <Transfer /> :
      sub === 'museum' ? <Museum id={nav.param ?? ''} /> :
      sub === 'editor' ? <Editor /> :
      sub === 'lost' ? <Lost /> :
      sub === 'settings' ? <Settings /> :
      sub === 'addDoc' ? <AddDoc kind={nav.param} /> :
      sub === 'doc' ? <DocDetail id={nav.param ?? ''} /> :
      nav.tab === 'today' ? <Today /> :
      nav.tab === 'map' ? <MapScreen /> :
      nav.tab === 'docs' ? <Docs /> :
      nav.tab === 'places' ? <Places /> :
      <Sos />;
    body = (
      <>
        {!online && <div className="banner">{t.offlineNow}</div>}
        <main id="scroller" className="scroller">
          <Suspense fallback={<div className="page muted">…</div>}>{page}</Suspense>
        </main>
        <TabBar />
      </>
    );
  }
  return (
    <div className="app">
      {body}
      <AlertSheet />
      <Toast />
    </div>
  );
}
