import { vi } from 'vitest';

vi.mock('keytar', () => ({
  getPassword: vi.fn().mockResolvedValue('mock-password'),
  setPassword: vi.fn().mockResolvedValue(undefined),
  deletePassword: vi.fn().mockResolvedValue(true),
  findPassword: vi.fn().mockResolvedValue('mock-password'),
  findCredentials: vi
    .fn()
    .mockResolvedValue([{ account: 'mock-account', password: 'mock-password' }]),
}));

vi.mock('level');

// import { GlobalContext } from '../src/context';

vi.mock('../src/context', () => ({
  GlobalContext: {
    workspace: 'test-workspace',
    debug: true,
    hasWorkspace: true,
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  },
}));

// vi.stubGlobal('GlobalContext', {
//   workspace: 'test-workspace',
//   debug: true,
//   hasWorkspace: true,
//   log: { debug: vi.fn() },
// });
