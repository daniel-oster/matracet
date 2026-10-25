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
// so a missing secret never fails the offers import. Sending itself lives in
// scripts/lib/push-send.mjs (shared with Läget's notification job).

import { readFileSync } from 'node:fs';
import { configureVapid, normalizePrivateKey, privateKeyProblem, readPublicKey, sendToAll } from './lib/push-send.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const PUBLIC_KEY = readPublicKey(new URL('../src/lib/push.ts', import.meta.url));
const privateKey = normalizePrivateKey(process.env.VAPID_PRIVATE_KEY);

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
const problem = privateKeyProblem(privateKey);
if (problem) {
  console.error(problem);
  process.exit(1);
}

const payload =
  arg === '--test'
    ? { title: 'Matracet', body: 'Testnotis – notiserna fungerar 🎉', url: '/matracet/?vy=nytt', tag: 'test' }
    : JSON.parse(readFileSync(arg, 'utf8'));

configureVapid(PUBLIC_KEY, privateKey);

const { subscriptions } = JSON.parse(readFileSync(`${ROOT}push-subscriptions.json`, 'utf8'));
if (!subscriptions.length) {
  console.log('Inga prenumerationer i push-subscriptions.json.');
  process.exit(0);
}

const { ok, total, lines } = await sendToAll(subscriptions, payload);
for (const line of lines) console.log(line);
console.log(`${ok} av ${total} notiser skickade: ${payload.title}`);
