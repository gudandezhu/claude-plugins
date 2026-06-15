#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const commandsDir = path.resolve(__dirname, '..', '..', 'commands');
const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md')).sort();
const commands = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(commandsDir, file), 'utf-8');
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) continue;

  const fm = fmMatch[1];

  if (/user-invocable:\s*false/i.test(fm)) continue;

  // 按 YAML 字段逐个解析
  const fields = {};
  let currentKey = null;
  let currentValue = null;

  for (const line of fm.split(/\r?\n/)) {
    const keyVal = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (keyVal) {
      if (currentKey) fields[currentKey] = currentValue;
      currentKey = keyVal[1];
      currentValue = keyVal[2] === '>' || keyVal[2] === '|' ? '' : keyVal[2];
    } else if (currentKey && /^\s+(.*)/.test(line)) {
      currentValue += ' ' + line.trim();
    }
  }
  if (currentKey) fields[currentKey] = currentValue;

  let description = (fields['description'] || '').trim();

  // 只取第一句（以句号结尾）
  const firstSentence = description.match(/^(.+?。)/);
  if (firstSentence) description = firstSentence[1];

  const hint = (fields['argument-hint'] || '-').trim();
  const cmdName = file.replace('.md', '');

  commands.push({ name: cmdName, description, hint });
}

const rows = commands.map(c =>
  `| \`/zcode:${c.name}\` | ${c.description} | ${c.hint} |`
);

console.log(`## zcode 可用命令

| 命令 | 说明 | 参数 |
|------|------|------|
${rows.join('\n')}`);
