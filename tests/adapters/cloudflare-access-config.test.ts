import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CloudflareAccessConfigError, readCloudflareAccessConfig } from '../../src/adapters/config/cloudflare-access-config.ts';
import { ConfigError, loadConfig } from '../../src/adapters/config/load-config.ts';
import { PublicOriginError, readPublicOrigin } from '../../src/adapters/config/public-origin.ts';

const TEAM = 'ludiars-test.cloudflareaccess.com';
const AUD = 'b'.repeat(64);
const serviceConfig = (access: unknown) => JSON.stringify({ cloudflareAccess: access, other: { kept: true } });

describe('Cloudflare Access config', () => {
  it('is not configured when neither value is set (the public entrance then answers 503)', () => {
    assert.equal(readCloudflareAccessConfig({}), undefined);
    assert.equal(readCloudflareAccessConfig({ BREVIARIUM_CF_ACCESS_TEAM_DOMAIN: ' ', BREVIARIUM_CF_ACCESS_AUD: '' }), undefined);
    assert.equal(readCloudflareAccessConfig({ EXCUBITOR_SERVICE_CONFIG_JSON: '{"other":1}' }), undefined);
  });

  it('reads the explicit pair into issuer and lower-case audience', () => {
    assert.deepEqual(readCloudflareAccessConfig({ BREVIARIUM_CF_ACCESS_TEAM_DOMAIN: TEAM.toUpperCase(), BREVIARIUM_CF_ACCESS_AUD: AUD.toUpperCase() }), {
      issuer: `https://${TEAM}`,
      audience: AUD,
    });
  });

  it('refuses one value alone', () => {
    assert.throws(() => readCloudflareAccessConfig({ BREVIARIUM_CF_ACCESS_TEAM_DOMAIN: TEAM }), CloudflareAccessConfigError);
    assert.throws(() => readCloudflareAccessConfig({ BREVIARIUM_CF_ACCESS_AUD: AUD }), CloudflareAccessConfigError);
  });

  it('refuses a team with a scheme or another domain, and an AUD that is not 64 hex characters', () => {
    for (const team of [`https://${TEAM}`, 'example.com', `${TEAM}/x`, 'evil.cloudflareaccess.com.example.test']) {
      assert.throws(() => readCloudflareAccessConfig({ BREVIARIUM_CF_ACCESS_TEAM_DOMAIN: team, BREVIARIUM_CF_ACCESS_AUD: AUD }), CloudflareAccessConfigError, team);
    }
    for (const aud of ['b'.repeat(63), 'g'.repeat(64), `${AUD}0`]) {
      assert.throws(() => readCloudflareAccessConfig({ BREVIARIUM_CF_ACCESS_TEAM_DOMAIN: TEAM, BREVIARIUM_CF_ACCESS_AUD: aud }), CloudflareAccessConfigError);
    }
  });

  it("reads Excubitor's service config JSON when no explicit env is set", () => {
    const env = { EXCUBITOR_SERVICE_CONFIG_JSON: serviceConfig({ teamDomain: TEAM, audience: AUD }) };
    assert.deepEqual(readCloudflareAccessConfig(env), { issuer: `https://${TEAM}`, audience: AUD });
  });

  it('lets the explicit env win and never completes one explicit value from the JSON', () => {
    const json = serviceConfig({ teamDomain: 'other.cloudflareaccess.com', audience: 'c'.repeat(64) });
    assert.deepEqual(readCloudflareAccessConfig({ EXCUBITOR_SERVICE_CONFIG_JSON: json, BREVIARIUM_CF_ACCESS_TEAM_DOMAIN: TEAM, BREVIARIUM_CF_ACCESS_AUD: AUD }), {
      issuer: `https://${TEAM}`,
      audience: AUD,
    });
    assert.throws(() => readCloudflareAccessConfig({ EXCUBITOR_SERVICE_CONFIG_JSON: json, BREVIARIUM_CF_ACCESS_AUD: AUD }), CloudflareAccessConfigError);
  });

  it('refuses malformed service config JSON and half pairs inside it', () => {
    for (const json of ['{', '[]', serviceConfig(null), serviceConfig({ teamDomain: TEAM }), serviceConfig({ teamDomain: TEAM, audience: 1 }), serviceConfig({ teamDomain: '', audience: AUD })]) {
      assert.throws(() => readCloudflareAccessConfig({ EXCUBITOR_SERVICE_CONFIG_JSON: json }), CloudflareAccessConfigError, json);
    }
    assert.throws(() => readCloudflareAccessConfig({ EXCUBITOR_SERVICE_CONFIG_JSON: serviceConfig({ teamDomain: TEAM, audience: 'short' }) }), CloudflareAccessConfigError);
  });
});

describe('public origin', () => {
  it('accepts an exact HTTPS origin and treats blank as unset', () => {
    assert.equal(readPublicOrigin('https://br.example.test'), 'https://br.example.test');
    assert.equal(readPublicOrigin('https://br.example.test:8443'), 'https://br.example.test:8443');
    assert.equal(readPublicOrigin(undefined), undefined);
    assert.equal(readPublicOrigin('  '), undefined);
  });

  it('refuses http, paths, trailing slashes, credentials, queries and fragments', () => {
    for (const value of ['http://br.example.test', 'https://br.example.test/', 'https://br.example.test/app', 'https://u:p@br.example.test', 'https://br.example.test?x=1', 'https://br.example.test#x', 'https://BR.example.test', 'br.example.test', 'https://*.example.test']) {
      assert.throws(() => readPublicOrigin(value), PublicOriginError, value);
    }
  });
});

describe('loadConfig with the public entrance', () => {
  const base = { BREVIARIUM_DATA_DIR: 'data', BREVIARIUM_HOST: '127.0.0.1', BREVIARIUM_PORT: '4370' };

  it('stays loopback-only with no public origin and no Access config by default', () => {
    const c = loadConfig(base);
    assert.equal(c.access.publicOrigin, undefined);
    assert.equal(c.cloudflareAccess, undefined);
    assert.deepEqual([...c.access.localAuthorities].sort(), ['127.0.0.1:4370', '[::1]:4370', 'localhost:4370']);
  });

  it('carries the public origin and the Access config', () => {
    const c = loadConfig({ ...base, LUDIARS_ALLOWED_HOSTS: '.example.test', BREVIARIUM_PUBLIC_URL: 'https://br.example.test', BREVIARIUM_CF_ACCESS_TEAM_DOMAIN: TEAM, BREVIARIUM_CF_ACCESS_AUD: AUD });
    assert.equal(c.access.publicOrigin, 'https://br.example.test');
    assert.equal(c.access.origins.has('https://br.example.test'), false);
    assert.deepEqual(c.cloudflareAccess, { issuer: `https://${TEAM}`, audience: AUD });
  });

  it('reports every entrance setting error as ConfigError', () => {
    assert.throws(() => loadConfig({ ...base, BREVIARIUM_PUBLIC_URL: 'https://br.example.test/path' }), ConfigError);
    assert.throws(() => loadConfig({ ...base, BREVIARIUM_CF_ACCESS_TEAM_DOMAIN: TEAM }), ConfigError);
    assert.throws(() => loadConfig({ ...base, EXCUBITOR_SERVICE_CONFIG_JSON: '{' }), ConfigError);
  });
});
