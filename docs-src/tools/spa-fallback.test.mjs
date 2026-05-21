import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const rootDir = path.resolve(import.meta.dirname, '..');

async function readInlineScript(filePath, marker) {
  const html = await readFile(filePath, 'utf8');
  const match = html.match(marker);

  if (!match) {
    throw new Error(`Cannot find inline script in ${filePath}`);
  }

  return match[1];
}

async function loadScripts() {
  const [indexScript, fallbackScript] = await Promise.all([
    readInlineScript(
      path.join(rootDir, 'index.html'),
      /<script nonce="safari-fix">([\s\S]+?)<\/script>/
    ),
    readInlineScript(
      path.join(rootDir, 'public/web-root/404.html'),
      /<script>\s*([\s\S]+?)\s*<\/script>/
    ),
  ]);

  return { indexScript, fallbackScript };
}

function executeIndexScript(script, location) {
  const calls = [];
  const window = {
    location: { ...location },
    history: {
      replaceState(_state, _title, url) {
        calls.push(url);
      },
    },
  };

  vm.runInNewContext(script, { window });

  return calls.at(-1);
}

function executeFallbackScript(script, location) {
  const calls = [];
  const window = {
    location: {
      ...location,
      replace(url) {
        calls.push(url);
      },
    },
    console: {
      log() {},
    },
  };

  vm.runInNewContext(script, { window, console: window.console });

  return calls.at(-1);
}

test('index fallback script unwraps nested fallback query in one pass', async () => {
  const { indexScript } = await loadScripts();
  const url = executeIndexScript(indexScript, {
    pathname: '/v7/',
    search: '?p=/&q=p=/~and~q=p=/en',
    hash: '',
  });

  assert.equal(url, '/v7/en');
});

test('index fallback script supports version root without trailing slash', async () => {
  const { indexScript } = await loadScripts();
  const url = executeIndexScript(indexScript, {
    pathname: '/v7',
    search: '?p=/en',
    hash: '',
  });

  assert.equal(url, '/v7/en');
});

test('404 fallback script preserves normal deep-link encoding', async () => {
  const { fallbackScript } = await loadScripts();
  const url = executeFallbackScript(fallbackScript, {
    pathname: '/v7/not-real',
    search: '',
    hash: '',
  });

  assert.equal(url, '/v7/?p=/not-real');
});

test('404 fallback script unwraps an already encoded fallback URL', async () => {
  const { fallbackScript } = await loadScripts();
  const url = executeFallbackScript(fallbackScript, {
    pathname: '/v7/',
    search: '?p=/&q=p=/~and~q=p=/en',
    hash: '',
  });

  assert.equal(url, '/v7/en');
});
