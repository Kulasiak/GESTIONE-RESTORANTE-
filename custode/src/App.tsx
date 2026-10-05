import { lazy, Suspense } from 'react';
import { useApp } from './state';
import { TabBar, Toast } from './components/ui';
import { AlertSheet } from './components/AlertSheet';
import { Welcome, RoleSetup } from './screens/Onboarding';
import { Login } from './screens/Login';
import { Scan } from './screens/Scan';
import { Today } from './screens/Today';
import { Docs, DocDetail, AddDoc } from './screens/Docs';
import { Lost } from './screens/Lost';
import { Places, Museum } from './screens/Places';
import { Transfer } from './screens/Transfer';
import { Sos } from './screens/Sos';
import { Settings } from './screens/Settings';
import { Expired } from './screens/Access';
import { Agency } from './screens/Agency';

// La mappa (Leaflet) e l'editor si caricano solo quando servono
const MapScreen = lazy(() => import('./screens/MapScreen'));
const Editor = lazy(() => import('./screens/Editor'));

export default function App() {
  const { nav, t, online, profile, expired } = useApp();
  let body: React.ReactNode;
  if (nav.screen === 'welcome') body = <Welcome />;
  else if (nav.screen === 'role') body = <RoleSetup />;
  else if (nav.screen === 'login') body = <Login />;
  else if (nav.screen === 'scan') body = <Scan onboarding />;
  else if (profile.role === 'agency') {
    body = nav.sub === 'settings' ? <main id="scroller" className="scroller"><Settings /></main> : <Agency />;
  } else if (expired && !['docs', 'sos'].includes(nav.tab) && !['settings', 'lost', 'doc', 'addDoc'].includes(nav.sub ?? '')) {
    // Pacchetto scaduto: restano aperti Documenti, SOS e Impostazioni
    body = (
      <>
        <main id="scroller" className="scroller"><Expired /></main>
        <TabBar />
      </>
    );
  } else {
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
