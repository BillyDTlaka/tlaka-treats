/**
 * Tests: app/(auth)/login.tsx
 * Role: Admin login screen using AuthContext
 */
import React from 'react'
import { render, fireEvent, act, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'
import LoginScreen from '../../app/(auth)/login'

const mockLogin = jest.fn()

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}))

jest.mock('../../lib/theme', () => ({
  COLORS: {
    white: '#fff', gray50: '#f9fafb', gray200: '#e5e7eb',
    gray400: '#9ca3af', gray500: '#6b7280', gray900: '#111827',
  },
  BRAND: '#8B3A3A',
}))

describe('LoginScreen (admin)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  })

  it('AUTH-01 — renders title, subtitle, and Sign In button', () => {
    const { getByText, getByPlaceholderText } = render(<LoginScreen />)

    expect(getByText('Tlaka Treats')).toBeTruthy()
    expect(getByText('Admin Portal')).toBeTruthy()
    expect(getByPlaceholderText('admin@tlakatreats.co.za')).toBeTruthy()
    expect(getByText('Sign In')).toBeTruthy()
  })

  it('AUTH-10 — shows alert when email is empty', async () => {
    const { getByText } = render(<LoginScreen />)

    await act(async () => {
      fireEvent.press(getByText('Sign In'))
    })

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter your email and password.')
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('AUTH-10 — shows alert when password is empty', async () => {
    const { getByText, getByPlaceholderText } = render(<LoginScreen />)

    fireEvent.changeText(getByPlaceholderText('admin@tlakatreats.co.za'), 'admin@tlakatreats.co.za')

    await act(async () => {
      fireEvent.press(getByText('Sign In'))
    })

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter your email and password.')
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('AUTH-01 — calls login with trimmed lowercased email on valid submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined)

    const { getByText, getByPlaceholderText } = render(<LoginScreen />)

    fireEvent.changeText(getByPlaceholderText('admin@tlakatreats.co.za'), '  Admin@TlakaT.co.za  ')
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'password123')

    await act(async () => {
      fireEvent.press(getByText('Sign In'))
    })

    expect(mockLogin).toHaveBeenCalledWith('admin@tlakat.co.za', 'password123')
  })

  it('AUTH-09 — shows error alert when login throws axios error', async () => {
    const err: any = new Error('Invalid credentials')
    err.response = { data: { message: 'Invalid credentials' } }
    mockLogin.mockRejectedValueOnce(err)

    const { getByText, getByPlaceholderText } = render(<LoginScreen />)

    fireEvent.changeText(getByPlaceholderText('admin@tlakatreats.co.za'), 'wrong@example.com')
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'badpassword')

    await act(async () => {
      fireEvent.press(getByText('Sign In'))
    })

    expect(Alert.alert).toHaveBeenCalledWith('Login Failed', 'Invalid credentials')
  })

  it('shows fallback error message when no response body', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Network Error'))

    const { getByText, getByPlaceholderText } = render(<LoginScreen />)

    fireEvent.changeText(getByPlaceholderText('admin@tlakatreats.co.za'), 'admin@test.com')
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'pass123')

    await act(async () => {
      fireEvent.press(getByText('Sign In'))
    })

    expect(Alert.alert).toHaveBeenCalledWith('Login Failed', 'Invalid credentials')
  })
})
