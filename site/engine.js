'use strict';

globalThis.FINN_ENGINE = (() => {
  const matching = value => String(value ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
  const ticker = value => String(value ?? '').trim().toUpperCase().replace(/\.NS$/, '');
  const timestamp = value => Date.parse(value.length === 10 ? value + 'T12:00:00+05:30' : value);
  const percentage = (current, previous) => previous > 0 ? (current / previous - 1) * 100 : null;
  const guidance = ([period, low, high, actual]) => ({
    period, low, high, actual, position: Math.max(0, Math.min(1, (actual-low)/(high-low))),
    verdict: actual < low ? 'Below range' : actual > high ? 'Above range' : 'Within range'
  });
  const inWindow = (date, now, days) => {
    const age = timestamp(now) - timestamp(date);
    return age >= 0 && age <= days * 86400000;
  };
  function context(data, symbol, person, theme = '') {
    const contact = data.contacts.find(item => item.ticker === symbol);
    const path = data.paths.find(item => item.person === person);
    if (path) return {...data.contacts.find(item => item.id === path.via), path};
    return contact ?? (theme ? data.contacts.find(item => item.themes.map(matching).includes(matching(theme))) : null);
  }
  function network(data, query) {
    const input = matching(query);
    if (!input) return [];
    const path = data.paths.find(item => input.includes(matching(item.name)));
    if (path) return data.contacts.filter(item => item.id === path.via).map(item => ({...item, path}));
    return data.contacts.map(item => {
      const fields = [item.name, item.ticker, item.employer, ...item.themes].filter(Boolean).map(matching);
      const tokens = input.split(' ').filter(token => token.length >= 3);
      const words = fields.join(' ').split(' ');
      const score = fields.includes(input) ? 10 : fields.some(field => (' '+input+' ').includes(' '+field+' '))
        ? 6 : tokens.filter(token => words.includes(token)).length;
      return {item, score};
    }).filter(({score}) => score > 0).sort((a,b) => b.score-a.score).map(({item}) => item);
  }
  function digest(events, now, days, category) {
    return events.filter(event => inWindow(event.date, now, days) && (category === 'All' || category === event.kind))
      .sort((a,b) => b.weight-a.weight || timestamp(b.date)-timestamp(a.date));
  }
  function alerts(bars, rules) {
    return bars.flatMap(bar => {
      const move = percentage(bar.close, bar.previous);
      const ratio = bar.mean > 0 ? bar.volume / bar.mean : null;
      if ((move !== null && Math.abs(move) >= rules.price - 1e-9) || (ratio !== null && ratio >= rules.volume)) {
        return [{...bar, move, ratio}];
      }
      return [];
    }).sort((a,b) => Math.max(Math.abs(b.move ?? 0)/rules.price, (b.ratio ?? 0)/rules.volume)
      - Math.max(Math.abs(a.move ?? 0)/rules.price, (a.ratio ?? 0)/rules.volume));
  }
  return {matching, ticker, percentage, guidance, context, network, digest, alerts, inWindow};
})();
