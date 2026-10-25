#!/usr/bin/env node
// Sends one web-push notification to every subscription in push-subscriptions.json.
// Run by .github/workflows/erbjudanden-weekly.yml after a commit that produced a
// notification (scripts/erbjudanden-weekly.mjs writes it to $NOTIS_FILE).
//
//   VAPID_PRIVATE_KEY=… node scripts/send-push.mjs notis.json
//   VAPID_PRIVATE_KEY=… node scripts/send-push.mjs --test     # "Testnotis" to everyone
//
// The public half of the VAPID key pair is in src/lib/push.ts; the private half exists
// only as the VAPID_PRIVATE_KEY GitHub secret. Without it this script logs and exits 0,
// so a missing secret never fails the offers import.
//
// A subscription answered with 404/410 has been revoked (app removed from the home
// screen, notifications turned off) — it's reported, not deleted, so the file stays
// hand-maintained.

import { readFileSync } from 'node:fs';
import webpush from 'web-push';

const ROOT = new URL('..', import.meta.url).pathname;
const PUBLIC_KEY = readFileSync(new URL('../src/lib/push.ts', import.meta.url), 'utf8').match(/'(B[\w-]{80,})'/)?.[1];
// Tolerate what a pasted GitHub secret usually picks up: whitespace/newlines and wrapping
// quotes or backticks. A real VAPID private key is 43 base64url chars (32 bytes).
const privateKey = (process.env.VAPID_PRIVATE_KEY ?? '').replace(/\s+/g, '').replace(/^[`'"]+|[`'"]+$/g, '');

const arg = process.argv[2];
if (!arg) {
  console.error('usage: node scripts/send-push.mjs <notis.json> | --test');
  process.exit(1);
}
if (!privateKey) {
  console.log('VAPID_PRIVATE_KEY saknas — ingen notis skickad.');
  process.exit(0);
}
if (!PUBLIC_KEY) throw new Error('Hittade inte VAPID_PUBLIC_KEY i src/lib/push.ts');
if (Buffer.from(privateKey, 'base64url').length !== 32) {
  // Never print the key itself — only enough to tell a truncated paste from an extra one.
  console.error(`VAPID_PRIVATE_KEY har fel längd (${privateKey.length} tecken, väntat 43). Klistra in den igen i repots Actions-secrets.`);
  process.exit(1);
}

const payload =
  arg === '--test'
    ? { title: 'Matracet', body: 'Testnotis – notiserna fungerar 🎉', url: '/matracet/?vy=nytt', tag: 'test' }
    : JSON.parse(readFileSync(arg, 'utf8'));

webpush.setVapidDetails('https://daniel-oster.github.io/matracet/', PUBLIC_KEY, privateKey);

const { subscriptions } = JSON.parse(readFileSync(`${ROOT}push-subscriptions.json`, 'utf8'));
if (!subscriptions.length) {
  console.log('Inga prenumerationer i push-subscriptions.json.');
  process.exit(0);
}

let ok = 0;
for (const { namn, subscription } of subscriptions) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 60 * 24 });
    ok++;
    console.log(`✓ ${namn}`);
  } catch (err) {
    const gone = err.statusCode === 404 || err.statusCode === 410;
    console.log(`✗ ${namn}: ${err.statusCode ?? ''} ${gone ? '(prenumerationen är avslutad — ta bort den)' : err.message}`);
  }
}
console.log(`${ok} av ${subscriptions.length} notiser skickade: ${payload.title}`);
