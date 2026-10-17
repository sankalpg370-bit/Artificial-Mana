import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ signIn: vi.fn(), getUser: vi.fn(), update: vi.fn(), signOut: vi.fn(), profile: vi.fn() }));
vi.mock('../lib/backend', () => ({ backend: {
  auth: { signInWithPassword: mocks.signIn, getUser: mocks.getUser, updateUser: mocks.update, signOut: mocks.signOut },
  from: () => ({ select: () => ({ eq: () => ({ single: mocks.profile }) }) }),
} }));
import StaffSetup from '../app/staff/setup/page';
const user = { id: 'owner-id', email: 'owner@example.com' };
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_BACKEND', 'supabase');
  vi.clearAllMocks();
  mocks.signIn.mockResolvedValue({ data: { user }, error: null });
  mocks.getUser.mockResolvedValue({ data: { user }, error: null });
  mocks.profile.mockResolvedValue({ data: { role: 'admin' }, error: null });
  mocks.update.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());
async function login() {
  fireEvent.change(screen.getByLabelText('Staff email'), { target: { value: user.email } });
  fireEvent.change(screen.getByLabelText('Current or temporary password'), { target: { value: 'test-temporary-value' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to set your password' }));
}
function fillPasswords() {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'test-new-password' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'test-new-password' } });
}
describe('private staff password setup', () => {
  it('does not offer password setup when the account has no staff role', async () => {
    mocks.profile.mockResolvedValue({ data: { role: 'student' }, error: null });
    render(<StaffSetup />); await login();
    expect(await screen.findByRole('alert')).toHaveTextContent('has not been granted staff access');
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('rejects a session changed by another tab before updating a password', async () => {
    render(<StaffSetup />); await login(); await screen.findByLabelText('New password'); fillPasswords();
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'other-user' } }, error: null });
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('sign-in changed');
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('keeps the form retryable when Auth rejects a change', async () => {
    mocks.update.mockResolvedValue({ error: { message: 'Password change rejected' } });
    render(<StaffSetup />); await login(); await screen.findByLabelText('New password'); fillPasswords();
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Password change rejected');
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(screen.getByLabelText('New password')).toBeInTheDocument();
  });
  it('saves the password and signs out only after a successful update', async () => {
    render(<StaffSetup />); await login(); await screen.findByLabelText('New password'); fillPasswords();
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
    expect(mocks.update).toHaveBeenCalledWith({ password: 'test-new-password' });
    expect(screen.getByRole('status')).toHaveTextContent('new password has been saved');
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });
});
