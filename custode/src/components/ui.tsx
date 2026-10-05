import { LANGS, type Lang } from '../i18n';
import { useApp, type Tab } from '../state';

export function LangSwitch({ dark }: { dark?: boolean }) {
  const { lang, setProfile } = useApp();
  return (
    <div className={'langs' + (dark ? ' dark' : '')} role="group" aria-label="Lingua / Language">
      {LANGS.map((l: Lang) => (
        <button key={l} className={l === lang ? 'on' : ''} aria-pressed={l === lang} onClick={() => setProfile({ lang: l })}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}

export function Back() {
  const { back } = useApp();
  return <button className="back" onClick={back} aria-label="Indietro">←</button>;
}

export function TabBar() {
  const { t, nav, go } = useApp();
  const tabs: [Tab, string][] = [['today', t.tToday], ['map', t.tMap], ['docs', t.tDocs], ['places', t.tPlaces], ['sos', t.tSos]];
  return (
    <nav className="tabbar">
      {tabs.map(([k, label]) => {
        const on = nav.tab === k && !nav.sub;
        return (
          <button key={k} className={(on ? 'on ' : '') + (k === 'sos' ? 'sos' : '')} aria-current={on ? 'page' : undefined} onClick={() => go({ tab: k })}>
            <div className="ind" />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function Toast() {
  const { toastMsg } = useApp();
  if (!toastMsg) return null;
  return <div className="toast" role="status"><div>{toastMsg}</div></div>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span className="label">{label}</span>{children}</label>;
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]!.toUpperCase()).join('') || '·';
