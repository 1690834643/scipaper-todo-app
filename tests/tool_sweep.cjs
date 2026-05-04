#!/usr/bin/env node
'use strict';

// Comprehensive sweep of every tool registered for the in-app AI / MCP surface.
// Run as: HOME=/tmp/sweep-home USERPROFILE=/tmp/sweep-home node tests/tool_sweep.cjs
// Auto-sets HOME if missing so the storage module points to a scratch dir.

const fs = require('fs');
const path = require('path');

if (!process.env.SCRATCH_HOME_SET) {
  const scratch = path.join('/tmp', 'sci-tool-sweep-' + Date.now());
  process.env.HOME = scratch;
  process.env.USERPROFILE = scratch;
  process.env.SCRATCH_HOME_SET = '1';
}
fs.rmSync(process.env.HOME, { recursive: true, force: true });
fs.mkdirSync(process.env.HOME, { recursive: true });

const { runTool } = require('../electron/toolRouter.cjs');
const { TOOLS } = require('../electron/llmTools.cjs');

const passed = [];
const failed = [];
const skipped = [];

async function call(name, args, expect = 'ok') {
  const r = await runTool(name, args);
  const ok = expect === 'ok' ? r.ok === true : r.ok === false;
  if (ok) {
    passed.push(name);
    return r;
  }
  failed.push({ name, expected: expect, got: r });
  return r;
}

async function main() {
  let articleId, thesisId, blockId, roundId, commentId, citationId, tagId, findingId, scenarioId, progressId;

  // ---- create_article ----
  let r = await call('create_article', {
    title: 'Sweep test paper',
    targetJournal: 'J. Sweep',
    researchContext: {
      scientificQuestion: 'Q',
      observedPhenomenon: 'P',
      hypothesis: 'H',
      approach: 'A',
    },
  });
  // create_article does not return the article in current code; pull from list_articles
  r = await call('list_articles', {});
  articleId = r.result[0].id;

  // ---- read tools (zero-arg / global) ----
  await call('list_articles', {});
  await call('list_theses', {});
  await call('get_writing_streak', {});
  await call('get_mood_history', {});
  await call('get_pomodoro_stats', {});
  await call('get_writing_stats', {});
  await call('get_theme', {});
  await call('list_scenarios', {});
  await call('get_italic_guide', {});
  await call('get_zotero_config', {});

  // ---- read tools (article-scoped) ----
  await call('find_article', { query: 'Sweep' });
  await call('get_article', { articleId });
  await call('get_research_context', { articleId });
  await call('list_sections', { articleId });
  await call('get_section_summary', { articleId, sectionType: 'Abstract' });
  await call('list_citations', { articleId });
  await call('list_pending_reviews', { articleId });
  await call('get_word_count', { articleId });
  await call('get_writing_guidance', { articleId, targetSection: 'Introduction' });

  // ---- update meta + research context ----
  await call('update_article_meta', { articleId, patch: { status: 'Drafting' } });
  await call('update_research_context', {
    articleId,
    researchContext: { scientificQuestion: 'Q2', observedPhenomenon: 'P2', hypothesis: 'H2', approach: 'A2' },
  });

  // ---- text blocks ----
  await call('add_text_block', { articleId, sectionType: 'Abstract', content: 'Hello *world*.', description: '' });
  // need block id
  r = await call('list_sections', { articleId });
  // get_section_summary returns sectionId & blockCount but not block ids; use get_article
  r = await call('get_article', { articleId });
  const article = r.result;
  blockId = article.sections.find((s) => s.type === 'Abstract').contentBlocks[0].id;

  await call('update_text_block', { articleId, blockId, content: 'Hello updated *world*.', description: 'edit' });

  // ---- citations ----
  await call('add_citation', {
    articleId,
    payload: { bibtex: '@article{x2026,title={X},author={Y},year={2026}}', title: 'X', authors: 'Y', year: '2026' },
  });
  r = await call('list_citations', { articleId });
  citationId = r.result[0].id;

  // ---- tags ----
  await call('add_tag', { articleId, tagName: 'urgent', tagColor: 'red' });
  // need tagId from article
  r = await call('get_article', { articleId });
  tagId = (r.result.tags || [])[0]?.id;
  if (tagId) await call('remove_tag', { articleId, tagId });
  else skipped.push('remove_tag (no tag id surfaced)');

  // ---- review round + comment + revision ----
  await call('add_review_round', { articleId, payload: { roundNumber: 1, journal: 'J' } });
  r = await call('get_article', { articleId });
  roundId = r.result.reviewRounds[0].id;
  await call('add_review_comment', {
    articleId,
    roundId,
    payload: { originalText: 'comment', type: 'Major', suggestedSection: 'Discussion' },
  });
  r = await call('list_pending_reviews', { articleId });
  commentId = r.result[0].commentId;
  await call('add_revision', { articleId, roundId, commentId, payload: { responseText: 'resp', markCompleted: false } });
  await call('update_review_comment_status', { articleId, roundId, commentId, status: 'Completed' });

  // ---- thesis ----
  await call('create_thesis', { title: 'Sweep thesis', degree: 'Master', author: 'A' });
  r = await call('list_theses', {});
  thesisId = r.result[0].id;
  await call('update_thesis_meta', { thesisId, patch: { status: 'InProgress' } });
  await call('add_thesis_section', { thesisId, sectionType: 'Chapter', title: 'Intro' });
  await call('link_article_to_thesis', { thesisId, articleId });
  await call('unlink_article_from_thesis', { thesisId, articleId });

  // ---- progress entries / findings / daily ----
  await call('add_progress_entry', {
    articleId,
    kind: 'read',
    title: 'Read paper X',
    detail: 'notes',
    minutesSpent: 30,
  });
  r = await call('list_progress_entries', {});
  progressId = r.result[0].id;
  await call('update_progress_entry', { entryId: progressId, patch: { detail: 'updated' } });

  await call('add_finding', { articleId, sectionType: 'Results', title: 'Finding 1', description: 'A1' });
  r = await call('list_findings', { articleId, sectionType: 'Results' });
  findingId = r.result[0].id;
  await call('link_progress_to_finding', { entryId: progressId, findingId });
  await call('update_finding', { articleId, findingId, patch: { status: 'done' } });
  await call('delete_finding', { articleId, findingId });
  await call('delete_progress_entry', { entryId: progressId });

  const today = new Date().toISOString().slice(0, 10);
  await call('start_daily_session', { date: today, planText: 'Plan' });
  await call('set_daily_plan', { date: today, planText: 'Updated plan' });
  await call('end_daily_session', { date: today, summaryText: 'Summary' });
  await call('get_daily_session', { date: today });

  // ---- mood + pomodoro ----
  await call('add_mood_entry', { mood: 'Calm', note: 'good' });
  await call('add_pomodoro_session', { duration: 25, articleId, sectionType: 'Introduction' });

  // ---- daily writing goal ----
  await call('update_daily_writing_goal', { goal: 800 });

  // ---- theme ----
  await call('set_theme', { theme: 'pixel' });
  await call('get_theme', {});

  // ---- auto-approve tools ----
  await call('get_auto_approve_tools', {});
  await call('set_auto_approve_tools', { value: true });
  r = await call('get_auto_approve_tools', {});
  if (r.result !== true) failed.push({ name: 'auto_approve roundtrip', got: r });
  await call('set_auto_approve_tools', { value: false });

  // ---- theme enum validation ----
  const badTheme = await runTool('set_theme', { theme: 'dark' });
  if (badTheme.ok || !/Invalid theme|invalid enum/i.test(badTheme.error || '')) failed.push({ name: 'validation:set_theme(bad)', got: badTheme });
  else passed.push('validation:set_theme(rejects-dark)');

  // ---- italic guide ----
  await call('set_italic_guide', { enabled: true, prompt: 'use italics for species names' });
  await call('get_italic_guide', {});

  // ---- zotero config ----
  await call('set_zotero_config', { endpoint: 'http://localhost:23119', userId: '0', enabled: false });
  await call('get_zotero_config', {});

  // ---- scenarios ----
  r = await call('add_scenario', { name: 'sweep-scn', systemPromptAddon: 'be terse', enabled: true });
  // addWritingScenario returns the new scenario; runTool wraps it
  scenarioId = r.result && r.result.id;
  if (scenarioId) {
    await call('update_scenario', { id: scenarioId, patch: { enabled: false } });
    await call('delete_scenario', { id: scenarioId });
  } else {
    skipped.push('update_scenario / delete_scenario (no scenario id surfaced)');
  }
  // reset_scenario only works on builtin
  r = await call('list_scenarios', {});
  const builtin = (r.result || []).find((s) => s.builtin);
  if (builtin) await call('reset_scenario', { id: builtin.id });
  else skipped.push('reset_scenario (no builtin scenario in DB)');

  // ---- attach_file ----
  const tmpFile = path.join(process.env.HOME, 'attach.txt');
  fs.writeFileSync(tmpFile, 'attached content');
  await call('attach_file', {
    articleId,
    sectionType: 'Results',
    kind: 'document',
    sourcePath: tmpFile,
    description: 'attached',
    kind: 'file',
  });

  // ---- exports (all six formats) ----
  for (const format of ['markdown', 'html', 'json', 'latex', 'share', 'docx']) {
    if (format === 'docx') {
      await call('export_article', { articleId, format, docxTemplate: 'academic-en' });
    } else {
      await call('export_article', { articleId, format });
    }
  }

  // ---- delete_block (do last on the article) ----
  await call('delete_block', { articleId, blockId });

  // ---- Zotero (intentionally skipped: needs network + auth) ----
  for (const z of [
    'zotero_search_library',
    'zotero_get_item_details',
    'zotero_list_collections',
    'zotero_get_collection_items',
    'zotero_get_item_fulltext',
  ]) skipped.push(z + ' (needs Zotero local server; not running in sandbox)');

  // ---- Sanity: validation should reject bad input ----
  const bad = await runTool('set_theme', {}); // missing required
  if (bad.ok || !/missing required/.test(bad.error || '')) failed.push({ name: 'validation:set_theme', got: bad });
  else passed.push('validation:set_theme(missing-required)');

  const badEnum = await runTool('export_article', { articleId, format: 'yaml' });
  if (badEnum.ok || !/invalid enum/.test(badEnum.error || '')) failed.push({ name: 'validation:export_article', got: badEnum });
  else passed.push('validation:export_article(bad-enum)');

  // ---- Report ----
  const tested = new Set(passed.map((p) => p.split('(')[0].trim()));
  const total = TOOLS.map((t) => t.name);
  const notExercised = total.filter((n) => !tested.has(n) && !skipped.find((s) => s.startsWith(n)));

  console.log('=== TOOL SWEEP REPORT ===');
  console.log('total tools:    ' + TOOLS.length);
  console.log('passed:         ' + passed.length);
  console.log('failed:         ' + failed.length);
  console.log('skipped:        ' + skipped.length);
  console.log('not exercised:  ' + notExercised.length);
  if (failed.length) {
    console.log('\n--- FAILED ---');
    for (const f of failed) console.log(' ✗ ' + f.name + ' :: ' + JSON.stringify(f.got).slice(0, 200));
  }
  if (skipped.length) {
    console.log('\n--- SKIPPED (with reason) ---');
    for (const s of skipped) console.log(' - ' + s);
  }
  if (notExercised.length) {
    console.log('\n--- NOT EXERCISED ---');
    for (const n of notExercised) console.log(' ? ' + n);
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
