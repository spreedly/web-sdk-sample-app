import { expect, test } from '@playwright/test';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

// Loads src/config.ts in a child Node under each env, as the server does at startup. The child runs in an
// empty directory so dotenv finds no .env, and gets only the env under test, so no real secret is read.

const ROOT = path.resolve(__dirname, '../..');
const CONFIG = path.join(ROOT, 'src', 'config.ts');

const BASE_ENV = { PUBLIC_APP_ORIGIN: 'https://checkout.example.test' };
const FASTLY_ENV = {
  FASTLY_SHARED_SECRET: 'edge-guard-test-secret-'.padEnd(40, 'x'),
  FASTLY_SECRET_HEADER: 'x-edge-secret',
  HEROKU_APP_HOST: 'example-app.herokuapp.com',
};

let cwd: string;

test.beforeAll(() => {
  cwd = mkdtempSync(path.join(tmpdir(), 'edge-guard-config-'));
});

test.afterAll(() => {
  rmSync(cwd, { recursive: true, force: true });
});

// Returns whether the edge guard and the login are on, or the startup error.
const loadConfig = (env: Record<string, string>) => {
  const program = `
    try {
      const config = require(${JSON.stringify(CONFIG)}).default;
      console.log(
        JSON.stringify({ guard: config.edgeGuard !== null, basicAuth: config.basicAuth !== null })
      );
    } catch (error) {
      console.log(JSON.stringify({ error: error.message }));
    }`;
  const result = spawnSync(
    process.execPath,
    ['-r', require.resolve('ts-node/register', { paths: [ROOT] }), '-e', program],
    {
      cwd,
      env: {
        PATH: process.env.PATH ?? '',
        TS_NODE_PROJECT: path.join(ROOT, 'tsconfig.json'),
        TS_NODE_TRANSPILE_ONLY: 'true',
        ...BASE_ENV,
        ...env,
      },
      encoding: 'utf8',
    }
  );
  return JSON.parse(result.stdout.trim().split('\n').pop() as string);
};

test.describe('The edge guard fails closed', () => {
  test('on Heroku without the Fastly vars, the app does not start', () => {
    expect(loadConfig({ DYNO: 'web.1' }).error).toMatch(/required on Heroku/);
  });

  test('on Heroku, EDGE_GUARD_DISABLED does not turn the guard off', () => {
    expect(loadConfig({ DYNO: 'web.1', EDGE_GUARD_DISABLED: 'true' }).error).toMatch(
      /required on Heroku/
    );
  });

  test('off Heroku without the Fastly vars or the opt-out, the app does not start', () => {
    expect(loadConfig({}).error).toMatch(/EDGE_GUARD_DISABLED=true/);
  });

  test('off Heroku, an opt-out other than "true" does not turn the guard off', () => {
    expect(loadConfig({ EDGE_GUARD_DISABLED: '1' }).error).toMatch(/EDGE_GUARD_DISABLED=true/);
  });

  test('off Heroku with EDGE_GUARD_DISABLED=true, the app starts with the guard off', () => {
    expect(loadConfig({ EDGE_GUARD_DISABLED: 'true' })).toMatchObject({ guard: false });
  });

  test('on Heroku with all three Fastly vars, the guard is on', () => {
    expect(loadConfig({ DYNO: 'web.1', ...FASTLY_ENV })).toMatchObject({ guard: true });
  });

  test('with all three Fastly vars, EDGE_GUARD_DISABLED does not turn the guard off', () => {
    expect(loadConfig({ EDGE_GUARD_DISABLED: 'true', ...FASTLY_ENV })).toMatchObject({ guard: true });
  });

  test('only some of the Fastly vars still fails', () => {
    expect(
      loadConfig({ DYNO: 'web.1', FASTLY_SHARED_SECRET: FASTLY_ENV.FASTLY_SHARED_SECRET }).error
    ).toMatch(/must be set together/);
  });
});

test.describe('The staging login (Basic Auth)', () => {
  const LOCAL = { EDGE_GUARD_DISABLED: 'true' };
  const PASSWORD = 'staging-login-test-password';

  test('is off when neither var is set', () => {
    expect(loadConfig(LOCAL)).toEqual({ guard: false, basicAuth: false });
  });

  test('is on when both vars are set', () => {
    expect(
      loadConfig({ ...LOCAL, BASIC_AUTH_USER: 'demo', BASIC_AUTH_PASSWORD: PASSWORD })
    ).toEqual({ guard: false, basicAuth: true });
  });

  test('only the user fails', () => {
    expect(loadConfig({ ...LOCAL, BASIC_AUTH_USER: 'demo' }).error).toMatch(/set together/);
  });

  test('only the password fails', () => {
    expect(loadConfig({ ...LOCAL, BASIC_AUTH_PASSWORD: PASSWORD }).error).toMatch(/set together/);
  });

  test('a password under 16 characters fails', () => {
    expect(
      loadConfig({ ...LOCAL, BASIC_AUTH_USER: 'demo', BASIC_AUTH_PASSWORD: 'short' }).error
    ).toMatch(/too short/);
  });

  test('a user with a colon fails', () => {
    expect(
      loadConfig({ ...LOCAL, BASIC_AUTH_USER: 'de:mo', BASIC_AUTH_PASSWORD: PASSWORD }).error
    ).toMatch(/colon/);
  });
});
