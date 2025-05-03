import { beforeAll, beforeEach, vi } from 'vitest';
import { GlobalContext } from '../src/context';

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

vi.mock('../src/context', () => ({
  GlobalContext: {},
}));

beforeAll(() => {
  process.env.TZ = 'EST';
});

beforeEach(() => {
  resetGlobalContext(GlobalContext);
});

const resetGlobalContext = (context: any) => {
  context.debug = true;
  context.currentUser = {
    user_id: 'U123',
    ok: true,
  };
  context.log = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  return context;
};
