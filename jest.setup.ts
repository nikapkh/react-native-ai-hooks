const originalConsoleError = console.error;
let consoleErrorSpy: jest.SpyInstance;

beforeAll(() => {
  global.fetch = jest.fn();

  // Required by React 18+ testing helpers so state updates inside act are tracked correctly.
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const firstArg = args[0];
    const message = typeof firstArg === 'string' ? firstArg : '';

    if (message.includes('react-test-renderer is deprecated')) {
      return;
    }

    originalConsoleError(...(args as Parameters<typeof console.error>));
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  consoleErrorSpy?.mockRestore();
});
