/** Bottom tab bar for the five top-level areas, following the iOS pattern: icon over label, current tab tinted. */
const TABS = [
  {
    id: 'home', href: '#/', label: 'Inici',
    icon: <><path d="M4 11.5 12 4l8 7.5" /><path d="M6.5 10v9.5h11V10" /></>,
  },
  {
    id: 'feed', href: '#/reptes', label: 'Reptes',
    icon: <><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></>,
  },
  {
    id: 'teoria', href: '#/teoria', label: 'Teoria',
    icon: <><path d="M12 6.5c-2-1.4-4.6-1.9-8-1.5v13c3.4-.4 6 .1 8 1.5 2-1.4 4.6-1.9 8-1.5V5c-3.4-.4-6 .1-8 1.5z" /><path d="M12 6.5v13" /></>,
  },
  {
    id: 'practica', href: '#/practica', label: 'Pràctica',
    icon: <><path d="M9 3.5h6l3.5 17h-13z" /><path d="M12 15.5 16.5 6" /><path d="M7.3 15.5h9.4" /></>,
  },
  {
    id: 'progres', href: '#/progres', label: 'Progrés',
    icon: <><path d="M5 20v-6" /><path d="M12 20V5" /><path d="M19 20v-10" /></>,
  },
] as const;

export function TabBar({ current }: { current: string }) {
  return (
    <nav className="tabbar" aria-label="Seccions">
      {TABS.map((t) => (
        <a key={t.id} href={t.href} className={t.id === current ? 'tab on' : 'tab'} aria-current={t.id === current ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">{t.icon}</svg>
          <span>{t.label}</span>
        </a>
      ))}
    </nav>
  );
}
