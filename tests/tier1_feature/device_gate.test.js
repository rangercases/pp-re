import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const indexHtml = fs.readFileSync(path.resolve(projectRoot, 'index.html'), 'utf8');

function extract(source, pattern, label) {
  const match = source.match(pattern);
  assert.ok(match, `${label} must be present in index.html`);
  return match[1] !== undefined ? match[1] : match[0];
}

function extractFnBody(source, signature, label) {
  const pattern = new RegExp(signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([\\s\\S]*?)\\n    \\}');
  return extract(source, pattern, label);
}

const detectBody = extractFnBody(indexHtml, 'function fasrepIsMobileOrTablet(ua, platform, maxTouchPoints)', 'fasrepIsMobileOrTablet');
const blocksBody = extractFnBody(indexHtml, 'function deviceGateBlocks()', 'deviceGateBlocks');

function makeGateApi(navigatorStub) {
  const factory = new Function(
    'navigator',
    `let currentUser = null;
     function fasrepIsMobileOrTablet(ua, platform, maxTouchPoints) {${detectBody}}
     function deviceGateBlocks() {${blocksBody}}
     return { fasrepIsMobileOrTablet, deviceGateBlocks, setUser(u) { currentUser = u; } };`
  );
  return factory(navigatorStub);
}

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipadLegacy: 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  macDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  androidPhone: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  windowsTouchLaptop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  linuxDesktop: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
};

// ─────────────────────────────────────────────────────────────────────────────
// TC-GATE.1 — device detection matrix
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-GATE.1: fasrepIsMobileOrTablet — detection matrix', () => {
  const api = makeGateApi({ userAgent: '', platform: '', maxTouchPoints: 0 });
  const detect = api.fasrepIsMobileOrTablet;

  it('iPhone UA is a phone', () => {
    assert.equal(detect(UA.iphone, 'iPhone', 5), true);
  });

  it('legacy iPad UA is a tablet', () => {
    assert.equal(detect(UA.ipadLegacy, 'iPad', 5), true);
  });

  it('iPadOS desktop-mode UA (Macintosh + MacIntel + multi-touch) is a tablet', () => {
    assert.equal(detect(UA.macDesktop, 'MacIntel', 5), true);
  });

  it('a real Mac (Macintosh UA + MacIntel + no multi-touch) is NOT blocked', () => {
    assert.equal(detect(UA.macDesktop, 'MacIntel', 0), false);
  });

  it('Android phone UA is a phone', () => {
    assert.equal(detect(UA.androidPhone, 'Linux armv8l', 5), true);
  });

  it('Android tablet UA (no "Mobile" token) is still a tablet', () => {
    assert.equal(detect(UA.androidTablet, 'Linux armv8l', 5), true);
  });

  it('a Windows touchscreen laptop is NOT blocked', () => {
    assert.equal(detect(UA.windowsTouchLaptop, 'Win32', 10), false);
  });

  it('a Linux desktop is NOT blocked', () => {
    assert.equal(detect(UA.linuxDesktop, 'Linux x86_64', 0), false);
  });

  it('an empty UA is NOT blocked', () => {
    assert.equal(detect('', '', 0), false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-GATE.2 — role logic: admins exempt, signed-out state never gated here
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-GATE.2: deviceGateBlocks — role logic', () => {
  const iphoneNav = { userAgent: UA.iphone, platform: 'iPhone', maxTouchPoints: 5 };
  const windowsNav = { userAgent: UA.windowsTouchLaptop, platform: 'Win32', maxTouchPoints: 10 };

  it('admin on an iPhone is NOT blocked', () => {
    const api = makeGateApi(iphoneNav);
    api.setUser({ role: 'admin', email: 'boss@example.com' });
    assert.equal(api.deviceGateBlocks(), false);
  });

  it('regular user on an iPhone IS blocked', () => {
    const api = makeGateApi(iphoneNav);
    api.setUser({ role: 'user', email: 'staff@example.com' });
    assert.equal(api.deviceGateBlocks(), true);
  });

  it('regular user on a Windows laptop is NOT blocked', () => {
    const api = makeGateApi(windowsNav);
    api.setUser({ role: 'user', email: 'staff@example.com' });
    assert.equal(api.deviceGateBlocks(), false);
  });

  it('signed-out state is NOT gated here (the auth screen handles it)', () => {
    const api = makeGateApi(iphoneNav);
    api.setUser(null);
    assert.equal(api.deviceGateBlocks(), false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-GATE.3 — wiring pins
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-GATE.3: device gate wiring in index.html', () => {
  it('the gate screen markup exists with its message and sign-out', () => {
    assert.ok(indexHtml.includes('id="deviceGateScreen"'), 'gate screen element must exist');
    assert.ok(indexHtml.includes('Laptop or desktop only'), 'gate message must exist');
    assert.ok(indexHtml.includes('id="deviceGateUser"'), 'gate shows the signed-in account');
  });

  it('startApp consults the gate before initializing the app', () => {
    const startAppBody = extractFnBody(indexHtml, 'function startApp()', 'startApp');
    const gateAt = startAppBody.indexOf('applyDeviceGate()');
    const initAt = startAppBody.indexOf('appInitialized = true');
    assert.ok(gateAt >= 0, 'startApp must call applyDeviceGate()');
    assert.ok(initAt > gateAt, 'the gate check must run before appInitialized is set');
  });

  it('the session refresh (online event) re-applies the gate', () => {
    const occurrences = indexHtml.split('applyDeviceGate()').length - 1;
    assert.ok(occurrences >= 3, `applyDeviceGate must be defined once and called from startApp + the online refresh (found ${occurrences})`);
  });
});
