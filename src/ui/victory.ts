/** Victory lines, two per fighter; the results screen picks one at random. */
export const WIN_QUOTES: Record<string, string[]> = {
  vega: ['Chrome never fades, sweetheart.', 'Catch the sunset next time. If you can.'],
  kaito: ['Blink and you missed it. You blinked.', 'Too slow for Neo-Tokyo. Too slow for me.'],
  roxy: ['Feel that? That was ten thousand volts of style.', 'Rio says hi. Loudly.'],
  brick: ['Built like a bulldozer. Played like one too.', 'Gold Coast rules: hit hard, smile harder.'],
  nova: ['See you on the dark side of the court.', 'Fastest wheels on the moon. And on this planet.'],
  diesel: ['Mic check: one, two... you lose.', 'Drop the beat. Drop the disc. Drop to the floor.'],
  saki: ['Now you see it... now you lost.', 'That was just the encore. You missed the show.'],
  zara: ['Nothing gets past me. Nothing.', 'Siberia was colder than your offense.'],
};

export const winQuote = (id: string) => {
  const q = WIN_QUOTES[id] ?? ['What a match!'];
  return q[Math.floor(Math.random() * q.length)];
};
