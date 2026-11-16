// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code registers: these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ACTIONS, SCENE_ACTIONS, SCENE_TRIGGERS, WIDGETS } from '../src/app.js';
import { DEFAULT_CONFIG } from '../src/config.js';

const read = async (path) => readFile(new URL(path, import.meta.url), 'utf8');
const manifest = JSON.parse(await read('../gladys-assistant-integration.json'));
const pkg = JSON.parse(await read('../package.json'));

const keysOf = (list) => (list ?? []).map((entry) => entry.key).sort();
const sorted = (object) => Object.values(object).sort();

// Every list of form fields the manifest declares (same field grammar).
const allFields = [
  ...manifest.config_schema,
  ...manifest.account_schema,
  ...[...manifest.actions, ...manifest.scene_triggers, ...manifest.scene_actions].flatMap(
    (item) => item.fields ?? [],
  ),
  ...manifest.widgets.flatMap((widget) => widget.settings ?? []),
];

test('actions, scene actions, scene triggers and widgets match the code, both ways', () => {
  assert.deepEqual(keysOf(manifest.actions), sorted(ACTIONS));
  assert.deepEqual(keysOf(manifest.scene_actions), sorted(SCENE_ACTIONS));
  assert.deepEqual(keysOf(manifest.scene_triggers), sorted(SCENE_TRIGGERS));
  assert.deepEqual(keysOf(manifest.widgets), sorted(WIDGETS));
});

test('a calendar integration with widget forms requires Gladys >= 5.2.0', () => {
  assert.equal(manifest.type, 'calendar');
  const [major, minor] = manifest.gladys_version
    .match(/>=\s*(\d+)\.(\d+)\.\d+/)
    .slice(1)
    .map(Number);
  assert.ok(major > 5 || (major === 5 && minor >= 2), manifest.gladys_version);
  assert.ok(manifest.categories.length >= 1 && manifest.categories.length <= 3);
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  const withDefault = manifest.config_schema.filter((field) => field.default !== undefined);
  assert.deepEqual(keysOf(withDefault), Object.keys(DEFAULT_CONFIG).sort());
  for (const field of withDefault) {
    assert.equal(DEFAULT_CONFIG[field.key], field.default, field.key);
  }
});

test('the token is a secret, and no other field could hold one', () => {
  const secrets = allFields.filter((field) => field.type === 'secret').map((field) => field.key);
  // Widget settings and scene fields are among them: they are not for credentials.
  assert.deepEqual(secrets, ['token']);
});

test('the widgets fit what a dashboard accepts from one integration', () => {
  assert.ok(manifest.widgets.length <= 5);
  // The store refuses a manifest whose widget description is longer.
  for (const widget of manifest.widgets) {
    for (const [lang, text] of Object.entries(widget.description)) {
      assert.ok(text.length <= 100, `${widget.key}.${lang}: ${text.length}`);
    }
  }
  // A setting a dashboard may leave empty: a widget dropped on it works at once.
  for (const setting of manifest.widgets.flatMap((widget) => widget.settings ?? [])) {
    assert.equal(setting.required, false, setting.key);
  }
});

test('what a scene declaration promises is never taken back', () => {
  const keys = (list, key, part) =>
    (list.find((item) => item.key === key)[part] ?? []).map((entry) => entry.key);
  // Scenes are written against these keys: a list here only grows.
  assert.deepEqual(keys(manifest.scene_triggers, 'task_due', 'variables'), [
    'title',
    'due',
    'assigned_to',
    'points',
    'count',
  ]);
  assert.deepEqual(keys(manifest.scene_triggers, 'task_completed', 'variables'), [
    'title',
    'assigned_to',
    'points',
    'count',
  ]);
  assert.deepEqual(keys(manifest.scene_actions, 'get_meals', 'outputs'), [
    'count',
    'menu',
    'breakfast',
    'lunch',
    'dinner',
    'snack',
  ]);
  assert.deepEqual(keys(manifest.scene_actions, 'get_points', 'outputs'), [
    'points',
    'streak',
    'summary',
  ]);
  // A field added to an action that scenes already use must stay optional.
  for (const action of manifest.scene_actions) {
    for (const field of action.fields ?? []) {
      if (!['item', 'title', 'text'].includes(field.key)) {
        assert.equal(field.required, false, `${action.key}.${field.key}`);
      }
    }
  }
});

test('sections are purely presentational, with https links', () => {
  for (const section of allFields.filter((field) => field.type === 'section')) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    assert.equal(section.placeholder, undefined);
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
});

test('every text is a multi-language object, in English and French', () => {
  const texts = [];
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return undefined;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'label' || key === 'description' || key === 'placeholder') texts.push(value);
      else visit(value);
    }
    return undefined;
  };
  visit(manifest);
  assert.ok(texts.length > 30);
  for (const text of texts) {
    assert.equal(typeof text, 'object');
    assert.ok(text.en && text.fr, JSON.stringify(text));
  }
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `${lang}: ${text.length}`);
  }
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`), manifest.docker_image);
  assert.equal(
    manifest.docker_image,
    manifest.docker_image.toLowerCase(),
    'registries want lowercase',
  );
});

test('the user documentation exists in both languages, with its four sections', async () => {
  const sections = {
    en: ['Overview', 'Requirements', 'Configuration', 'Troubleshooting'],
    fr: ['Présentation', 'Prérequis', 'Configuration', 'Dépannage'],
  };
  for (const [lang, titles] of Object.entries(sections)) {
    const doc = await read(`../docs/${lang}.md`);
    assert.ok(doc.length >= 300, `docs/${lang}.md is too short`);
    for (const title of titles) {
      assert.match(doc, new RegExp(`^## ${title}`, 'm'), `docs/${lang}.md: ${title}`);
    }
  }
});
