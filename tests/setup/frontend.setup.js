import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { jest } from '@jest/globals';
// Configure React Testing Library
configure({ testIdAttribute: 'data-testid' });
// Mock Next.js Router
jest.mock('next/router', () => ({
    useRouter: () => ({
        route: '/',
        pathname: '/',
        query: {},
        asPath: '/',
        push: jest.fn(() => Promise.resolve(true)),
        replace: jest.fn(() => Promise.resolve(true)),
        reload: jest.fn(),
        back: jest.fn(),
        prefetch: jest.fn(() => Promise.resolve()),
        beforePopState: jest.fn(),
        events: {
            on: jest.fn(),
            off: jest.fn(),
            emit: jest.fn()
        }
    })
}));
// Mock Electron IPC renderer
const mockIpcRenderer = {
    invoke: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    send: jest.fn()
};
// Mock window.electron
Object.defineProperty(window, 'electron', {
    value: {
        ipcRenderer: mockIpcRenderer
    },
    writable: true
});
// Mock IntersectionObserver
class MockIntersectionObserver {
    constructor() {
        this.observe = jest.fn();
        this.unobserve = jest.fn();
        this.disconnect = jest.fn();
    }
}
Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver
});
// Mock ResizeObserver
class MockResizeObserver {
    constructor() {
        this.observe = jest.fn();
        this.unobserve = jest.fn();
        this.disconnect = jest.fn();
    }
}
Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: MockResizeObserver
});
// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(), // deprecated
        removeListener: jest.fn(), // deprecated
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
    }))
});
// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => {
            store[key] = value.toString();
        },
        removeItem: (key) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        }
    };
})();
Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
});
// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
    value: localStorageMock
});
// Suppress specific console warnings in tests
const originalError = console.error;
const originalWarn = console.warn;
beforeAll(() => {
    console.error = (...args) => {
        if (typeof args[0] === 'string' &&
            args[0].includes('Warning: ReactDOM.render')) {
            return;
        }
        originalError.call(console, ...args);
    };
    console.warn = (...args) => {
        if (typeof args[0] === 'string' &&
            (args[0].includes('componentWillReceiveProps') ||
                args[0].includes('componentWillMount'))) {
            return;
        }
        originalWarn.call(console, ...args);
    };
});
afterAll(() => {
    console.error = originalError;
    console.warn = originalWarn;
});
// Clean up after each test
afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
});
