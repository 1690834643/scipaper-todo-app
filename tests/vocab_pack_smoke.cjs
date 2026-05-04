// Smoke check the pack registry. Uses the project's installed rolldown (vite's bundler).
const path = require('path');
const tmp = '/tmp/vocab-pack-smoke-bundle.mjs';

(async () => {
  const { rolldown } = require(path.join(process.cwd(), 'node_modules/rolldown'));
  const bundle = await rolldown({
    input: path.join(process.cwd(), 'src/data/sci-vocab.ts'),
  });
  await bundle.write({ file: tmp, format: 'esm' });
  await bundle.close();

  const mod = await import('file://' + tmp);
  const { BUILTIN_PACKS, SCI_WORDS, aggregatePackWords } = mod;

  let pass = true;
  const eq = (label, got, want) => {
    const ok = Object.is(got, want);
    console.log(`${ok ? 'OK' : 'FAIL'}  ${label}: ${got}${ok ? '' : ' (want ' + want + ')'}`);
    if (!ok) pass = false;
  };

  eq('builtin pack count', BUILTIN_PACKS.length, 11);
  const onIds = BUILTIN_PACKS.filter(p => p.defaultEnabled).map(p => p.id);
  const offIds = BUILTIN_PACKS.filter(p => !p.defaultEnabled).map(p => p.id);
  eq('default-on count', onIds.length, 6);
  eq('default-off count', offIds.length, 5);

  const sections = ['general', 'introduction', 'methods', 'results', 'discussion'];
  const defaultOnly = aggregatePackWords(BUILTIN_PACKS.filter(p => p.defaultEnabled));

  eq('doublesex absent from default-only',
     sections.some(s => defaultOnly[s].includes('doublesex')), false);
  eq('doublesex present in legacy SCI_WORDS',
     sections.some(s => SCI_WORDS[s].includes('doublesex')), true);
  eq('Chilo absent from default-only',
     sections.some(s => defaultOnly[s].includes('Chilo')), false);
  eq('DESeq2 absent from default-only',
     sections.some(s => defaultOnly[s].includes('DESeq2')), false);
  eq('hypothesize present in default-only',
     defaultOnly.introduction.includes('hypothesize'), true);
  eq('PCR present in default-only',
     defaultOnly.general.includes('PCR'), true);

  console.log('\n--- pack sizes ---');
  for (const p of BUILTIN_PACKS) {
    const total = sections.reduce((n, s) => n + (p.words[s]?.length || 0), 0);
    const phr = sections.reduce((n, s) => n + (p.phrases[s]?.length || 0), 0);
    console.log(`  [${p.defaultEnabled ? 'ON ' : 'off'}] ${p.id.padEnd(22)} ${total.toString().padStart(4)} words, ${phr} phrases`);
  }
  console.log('\n--- aggregated sizes ---');
  for (const s of sections) {
    console.log(`  ${s.padEnd(13)} all=${SCI_WORDS[s].length}  default-only=${defaultOnly[s].length}`);
  }

  // ---- storage layer (commit 2) ----
  console.log('\n--- storage layer ---');
  const fs = require('fs');
  const tmpHome = '/tmp/scipaper-vocab-pack-test-' + Date.now();
  fs.mkdirSync(tmpHome, { recursive: true });
  process.env.HOME = tmpHome;
  const storage = require(path.join(process.cwd(), 'electron/storage.cjs'));
  const registry = require(path.join(process.cwd(), 'electron/vocabPackRegistry.cjs'));

  eq('registry id count', registry.BUILTIN_PACK_IDS.length, BUILTIN_PACKS.length);
  const fromTs = BUILTIN_PACKS.map(p => p.id).slice().sort().join(',');
  const fromCjs = registry.BUILTIN_PACK_IDS.slice().sort().join(',');
  eq('registry IDs match TS BUILTIN_PACKS', fromCjs, fromTs);

  const packs0 = storage.listVocabPacks();
  eq('listVocabPacks count (fresh db)', packs0.length, 11);
  eq('default-on returned correctly', packs0.filter(p => p.enabled).length, 6);

  const afterToggle = storage.setVocabPackEnabled('sex-determination', true);
  eq('setVocabPackEnabled flips state',
     afterToggle.find(p => p.id === 'sex-determination').enabled, true);

  const imported = storage.importVocabPack({
    name: 'lab vocab', words: ['AOX', 'Cscaspase'],
  });
  eq('imported pack carries words', imported.words.general.includes('AOX'), true);

  const afterRename = storage.renameCustomVocabPack(imported.id, 'My lab');
  eq('rename works', afterRename.name, 'My lab');

  const afterDelete = storage.deleteCustomVocabPack(imported.id);
  eq('delete removes custom pack',
     afterDelete.filter(p => !p.builtin).length, 0);

  let threw = false;
  try { storage.deleteCustomVocabPack('core-academic'); } catch { threw = true; }
  eq('delete builtin rejected', threw, true);

  threw = false;
  try { storage.setVocabPackEnabled('nonexistent', true); } catch { threw = true; }
  eq('setEnabled unknown rejected', threw, true);

  threw = false;
  try { storage.importVocabPack({ name: 'empty' }); } catch { threw = true; }
  eq('empty pack rejected', threw, true);

  process.exit(pass ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
