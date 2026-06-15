const { test, expect } = require('@playwright/test');
const path = require('path');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'index.html');

async function load(page, target) {
  await page.goto(`${PAGE}?target=${target}`);
}

async function guess(page, n) {
  await page.fill('#guessInput', String(n));
  await page.click('#guessBtn');
  return page.textContent('#feedback');
}

// 基线 spec v1.0.0 的三个场景

test('SC-001: 猜对数字', async ({ page }) => {
  await load(page, 50);
  const fb = await guess(page, 50);
  expect(fb).toContain('猜对了');
});

test('SC-002: 猜小了', async ({ page }) => {
  await load(page, 50);
  const fb = await guess(page, 30);
  expect(fb).toContain('太小了');
});

test('SC-003: 猜大了', async ({ page }) => {
  await load(page, 50);
  const fb = await guess(page, 80);
  expect(fb).toContain('太大了');
});

test('SC-004: 超过猜测次数限制', async ({ page }) => {
  await load(page, 50);
  let fb;
  for (let i = 0; i < 7; i++) {
    fb = await guess(page, 1);
  }
  expect(fb).toContain('次数用尽');
});
