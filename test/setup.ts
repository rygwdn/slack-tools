import { beforeAll, beforeEach, vi } from 'vitest';
import { GlobalContext } from '../src/context';

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
