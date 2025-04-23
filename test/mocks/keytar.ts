// Mock implementation of keytar for CI
export function getPassword(_service: string, _account: string): Promise<string | null> {
  return Promise.resolve('mock-password');
}

export function setPassword(_service: string, _account: string, _password: string): Promise<void> {
  return Promise.resolve();
}

export function deletePassword(_service: string, _account: string): Promise<boolean> {
  return Promise.resolve(true);
}

export function findPassword(_service: string): Promise<string | null> {
  return Promise.resolve('mock-password');
}

export function findCredentials(_service: string): Promise<Array<{ account: string; password: string }>> {
  return Promise.resolve([{ account: 'mock-account', password: 'mock-password' }]);
}