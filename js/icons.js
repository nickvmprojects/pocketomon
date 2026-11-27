// v0.7.5 "Rift": line icons for the UI and one sigil per dimension (replaces emoji in the interface).
// All icons are 24x24, drawn with currentColor so CSS decides the colour.
const S = (body, extra = '') => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const IC = {
  coin: S('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 10c0-1.2 1.1-1.8 2.5-1.8s2.5.6 2.5 1.8-1.1 1.6-2.5 2-2.5.8-2.5 2 1.1 1.8 2.5 1.8 2.5-.6 2.5-1.8"/>'),
  heart: S('<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z" fill="currentColor" stroke="none"/>'),
  heartO: S('<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/>'),
  bolt: S('<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z" fill="currentColor" stroke="none"/>'),
  hp: S('<path d="M12 3.5 19 6v6c0 4.2-3 7.2-7 8.5-4-1.3-7-4.3-7-8.5V6z"/><path d="M12 9v6M9 12h6"/>'),
  trophy: S('<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5A3 3 0 0 0 7 10.5M17 6h3v1.5a3 3 0 0 1-3 3M12 14v3.5M8.5 20.5h7M9.5 17.5h5"/>'),
  dice: S('<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="8.6" cy="8.6" r="1.2" fill="currentColor"/><circle cx="15.4" cy="15.4" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="15.4" cy="8.6" r="1.2" fill="currentColor"/><circle cx="8.6" cy="15.4" r="1.2" fill="currentColor"/>'),
  swords: S('<path d="M14.5 4H20v5.5L9 20.5 3.5 15z" stroke-width="1.8"/><path d="M6 12.5 11.5 18M3 21l3-3"/>'),
  fight: S('<path d="M4 4l9.5 9.5M20 4l-9.5 9.5M4 4h3.5M4 4v3.5M20 4h-3.5M20 4v3.5M8 16l-3 3M16 16l3 3M6.5 13.5l4 4M17.5 13.5l-4 4"/>'),
  menu: S('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: S('<path d="M6 6l12 12M18 6 6 18"/>'),
  lock: S('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  unlock: S('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 7.6-1.7"/>'),
  bell: S('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
  aura: S('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.6 2.6M15.8 15.8l2.6 2.6M18.4 5.6l-2.6 2.6M8.2 15.8l-2.6 2.6"/>'),
  soundOn: S('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke-width="1.5"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  soundOff: S('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke-width="1.5"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  pause: S('<path d="M8 5v14M16 5v14" stroke-width="3"/>'),
  play: S('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
  skip: S('<path d="M5 5l8 7-8 7zM13 5l8 7-8 7z" fill="currentColor" stroke-width="1.5"/>'),
  trash: S('<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 10.5v6M14 10.5v6"/>'),
  arrow: S('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  back: S('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  book: S('<path d="M4 5.5A2 2 0 0 1 6 4h13v14H6a2 2 0 0 0-2 2z"/><path d="M4 20V5.5M8 8h7"/>'),
  grid: S('<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>'),
  spark: S('<path d="M12 3l1.8 6.2L20 12l-6.2 1.8L12 21l-1.8-7.2L4 12l6.2-2.8z" fill="currentColor" stroke="none"/>'),
  star: S('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="currentColor" stroke="none"/>'),
  gift: S('<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11M12 9c-1.5-3-5-4-5-1.5S10 9 12 9zM12 9c1.5-3 5-4 5-1.5S14 9 12 9z"/>'),
  vs: S('<path d="M3.5 6l3.5 12 3.5-12M20 7.5c-.8-1-2-1.5-3.3-1.5-1.7 0-3 .9-3 2.4 0 3.4 6.6 2.1 6.6 5.6 0 1.5-1.4 2.6-3.3 2.6-1.4 0-2.7-.6-3.5-1.6"/>'),
  classic: S('<rect x="3.5" y="5" width="17" height="12" rx="2"/><path d="M8 21h8M12 17v4M7 9h4M7 12.5h7"/>'),
};

// one sigil per dimension: simple, geometric, readable at 14px
export const SIGIL = {
  fallen: S('<ellipse cx="12" cy="10.5" rx="9" ry="3"/><path d="M8 9.2a4 4 0 0 1 8 0"/><path d="M9 13.5l-2 6M15 13.5l2 6M12 13.8v6" stroke-dasharray="1.5 2"/>'),
  martial: S('<path d="M18.6 8.2A7.5 7.5 0 1 0 19 15.2" stroke-width="2.8"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>'),
  zodiac: S('<path d="M12 2.5l2 7.5 7.5 2-7.5 2-2 7.5-2-7.5-7.5-2 7.5-2z" fill="currentColor" fill-opacity=".25"/><circle cx="19" cy="5" r="1" fill="currentColor"/><circle cx="5" cy="19" r="1" fill="currentColor"/>'),
  giants: S('<path d="M6 3.5c2 4 2.5 11-1 17M12 3c1.5 4.5 1.5 12-1.5 18M18.5 3.5c1 4 .5 11-3 17" stroke-width="2.3"/>'),
  elven: S('<path d="M12 21.5C5 16 5 8 12 2.5c7 5.5 7 13.5 0 19z"/><path d="M12 6v15.5M12 11l-3-2.5M12 15l3.5-3"/>'),
  necro: S('<path d="M5 4h14v9.5l-3.5 3.5v3.5h-7V17L5 13.5z"/><path d="M8.5 9.5h2.5M13 9.5h2.5" stroke-width="2.6"/><path d="M10.5 17v3.5M13.5 17v3.5"/>'),
  junk: S('<circle cx="12" cy="12" r="8.5"/><path d="M8 8l8 8M16 8l-8 8"/><path d="M3.5 12h-1M21.5 12h-1M12 3.5v-1" stroke-width="1.5"/>'),
  abyss: S('<path d="M12 12.2a.8.8 0 1 1 .8-.8 2.4 2.4 0 1 1-2.4 2.4A4 4 0 1 1 14.4 9a5.6 5.6 0 1 1-8 7.6M2.5 21.5c2-1.5 3.5-1.5 5.5 0s3.5 1.5 5.5 0 3.5-1.5 5.5 0"/>'),
  dream: S('<path d="M15 3.5A8.5 8.5 0 1 0 20.5 15 7 7 0 0 1 15 3.5z"/><path d="M15.5 9.5h3l-3 3.5h3" stroke-width="1.6"/>'),
  clock: S('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/><circle cx="12" cy="12" r="6.5"/>'),
};

// short "coordinates" for each dimension: pure flavour for labels
export const COORD = { fallen: 'D-01', martial: 'D-02', zodiac: 'D-03', giants: 'D-04', elven: 'D-05', necro: 'D-06', junk: 'D-07', abyss: 'D-08', dream: 'D-09', clock: 'D-10' };
