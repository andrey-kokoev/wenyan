#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const baseUrl = process.env.WENYAN_API_URL ?? 'http://127.0.0.1:8787/api/wenyan';

async function postMessage(input: string) {
  const body = JSON.parse(input);
  const res = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}

async function status(id: string) {
  const res = await fetch(`${baseUrl}/messages/${id}`);
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}

async function query(state: string) {
  const res = await fetch(`${baseUrl}/messages?state=${encodeURIComponent(state)}`);
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}

async function stream() {
  const res = await fetch(`${baseUrl}/stream`);
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'submit') {
    if (arg) {
      await postMessage(await readFile(arg, 'utf8'));
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    await postMessage(Buffer.concat(chunks).toString('utf8'));
    return;
  }
  if (cmd === 'status' && arg) {
    await status(arg);
    return;
  }
  if (cmd === 'query' && arg) {
    await query(arg);
    return;
  }
  if (cmd === 'stream') {
    await stream();
    return;
  }
  console.error('Usage: wenyan submit <file|stdin> | status <id> | stream | query <state>');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
