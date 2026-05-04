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

  process.exit(pass ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
