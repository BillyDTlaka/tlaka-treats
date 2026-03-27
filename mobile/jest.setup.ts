import '@testing-library/jest-native/extend-expect'

// Mock expo-router globally
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
  Link: ({ children }: any) => children,
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
}))

// Mock expo-secure-store globally
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: { extra: { apiUrl: 'http://localhost:3000' } },
    expoGoConfig: null,
  },
}))

// Mock global fetch
global.fetch = jest.fn()
