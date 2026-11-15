'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');

require('../site/market-data.js');
require('../site/data.js');
require('../site/engine.js');
const {FINN_DATA: data, FINN_ENGINE: engine} = globalThis;

test('India-time filing windows, source priorities and category filters', () => {
  assert.deepEqual(engine.digest(data.events, data.replay, 1, 'All').map(e => e.id), ['infy-q4', 'infy-timing']);
  assert.equal(engine.digest(data.events, data.replay, 7, 'Leadership')[0].id, 'hcl-director');
  assert.equal(engine.digest(data.events, data.replay, 30, 'M&A')[0].id, 'infy-acq');
});

test('official replay bars and independent triggers', () => {
  assert.equal(data.market.length, 17);
  assert.deepEqual(engine.alerts(data.market, {price:2, volume:1.9}).map(x => x.ticker), ['INFY','AUBANK']);
  assert.deepEqual(engine.alerts(data.market, {price:4, volume:3}), []);
  assert.equal(engine.alerts([{ticker:'X', close:101, previous:100, volume:1, mean:null}], {price:3,volume:2}).length, 0);
});

test('direct and named network queries reuse the same evidence', () => {
  assert.equal(engine.context(data,'INFY').id, 'mira');
  const [lead] = engine.network(data, 'Who knows Kimsuka Narsimhan?');
  assert.equal(lead.id, engine.context(data,'HCLTECH','kimsuka').id);
  assert.match(lead.path.detail, /Confirm relevant dates/);
  assert.equal(engine.network(data,'rural lending')[0].id, 'kabir');
  assert.deepEqual(engine.network(data,'aviation'), []);
});

test('guidance is compared using guided-currency revenue', () => {
  const verdicts = data.research.WIPRO.guidance.rows.map(engine.guidance);
  assert.equal(verdicts.filter(row => row.verdict === 'Within range').length, 4);
  assert.ok(verdicts[3].position < 0.15);
  assert.equal(engine.guidance(['Example',100,110,95]).verdict, 'Below range');
});
