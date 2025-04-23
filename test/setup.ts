import { vi } from 'vitest';

// Mock the keytar module
vi.mock('keytar', () => ({
  getPassword: vi.fn().mockResolvedValue('mock-password'),
  setPassword: vi.fn().mockResolvedValue(undefined),
  deletePassword: vi.fn().mockResolvedValue(true),
  findPassword: vi.fn().mockResolvedValue('mock-password'),
  findCredentials: vi.fn().mockResolvedValue([{ account: 'mock-account', password: 'mock-password' }]),
}));