// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PasswordSetup from './PasswordSetup';
const { getUser, updateUser, resetPasswordForEmail } = vi.hoisted(() => ({ getUser: vi.fn(), updateUser: vi.fn(), resetPasswordForEmail: vi.fn() }));
vi.mock('./api', () => ({ client: { auth: { getUser, updateUser, resetPasswordForEmail } } }));
beforeEach(() => { getUser.mockResolvedValue({ data: { user: { id: 'invited-coach' } }, error: null }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('password setup from invite/recovery links', () => {
  it('does not submit mismatched confirmation', () => {
    render(<PasswordSetup ownerId="invited-coach" onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'invented-fixture-only' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'different-fixture-only' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save password' }).closest('form')!);
    expect(updateUser).not.toHaveBeenCalled(); expect(screen.getByRole('alert').textContent).toContain('must match');
  });
  it('keeps the form open and displays a rejected password', async () => {
    updateUser.mockResolvedValue({ error: new Error('Password rejected') });
    const done = vi.fn(); render(<PasswordSetup ownerId="invited-coach" onComplete={done} onCancel={vi.fn()} />);
    for (const label of ['New password', 'Confirm password']) fireEvent.change(screen.getByLabelText(label), { target: { value: 'invented-fixture-only' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save password' }).closest('form')!);
    await screen.findByText('Password rejected'); expect(done).not.toHaveBeenCalled();
  });
  it('saves the password for the verified invited account and completes setup', async () => {
    updateUser.mockResolvedValue({ error: null });
    const done = vi.fn(); render(<PasswordSetup ownerId="invited-coach" email="new-coach@example.test" onComplete={done} onCancel={vi.fn()} />);
    expect(screen.getByText('new-coach@example.test')).toBeTruthy();
    for (const label of ['New password', 'Confirm password']) fireEvent.change(screen.getByLabelText(label), { target: { value: 'invented-fixture-only' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save password' }).closest('form')!);
    await vi.waitFor(() => expect(done).toHaveBeenCalledTimes(1));
    expect(updateUser).toHaveBeenCalledWith({ password: 'invented-fixture-only' });
  });
  it('does not change a password when another tab has switched the authenticated account', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'different-coach' } }, error: null });
    const done = vi.fn(); render(<PasswordSetup ownerId="invited-coach" onComplete={done} onCancel={vi.fn()} />);
    for (const label of ['New password', 'Confirm password']) fireEvent.change(screen.getByLabelText(label), { target: { value: 'invented-fixture-only' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save password' }).closest('form')!);
    await screen.findByText(/signed in with a different account/);
    expect(updateUser).not.toHaveBeenCalled(); expect(done).not.toHaveBeenCalled();
  });

  it('shows a connection failure without incorrectly claiming the account changed', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' } });
    render(<PasswordSetup ownerId="invited-coach" onComplete={vi.fn()} onCancel={vi.fn()} />);
    for (const label of ['New password', 'Confirm password']) fireEvent.change(screen.getByLabelText(label), { target: { value: 'synthetic-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    await screen.findByText(/Check your connection and try again/);
    expect(screen.queryByText(/different account/)).toBeNull(); expect(updateUser).not.toHaveBeenCalled();
  });
  it('offers a fresh setup link for an expired session and sends only when clicked', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthSessionMissingError', status: 400 } });
    resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<PasswordSetup ownerId="invited-coach" email="new-coach@example.test" onComplete={vi.fn()} onCancel={vi.fn()} />);
    for (const label of ['New password', 'Confirm password']) fireEvent.change(screen.getByLabelText(label), { target: { value: 'synthetic-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    await screen.findByText(/sign-in session is no longer available/);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Send a new setup link' }));
    await screen.findByText(/Check your email for a new setup link/);
    expect(resetPasswordForEmail).toHaveBeenCalledWith('new-coach@example.test', { redirectTo: 'https://teamtracker.leftbraincreative.xyz/' });
    expect(updateUser).not.toHaveBeenCalled();
  });
  it('does not submit the password when the secondary Sign out button is clicked', () => {
    const cancel = vi.fn(); render(<PasswordSetup ownerId="invited-coach" onComplete={vi.fn()} onCancel={cancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(cancel).toHaveBeenCalledTimes(1); expect(updateUser).not.toHaveBeenCalled(); expect(getUser).not.toHaveBeenCalled();
  });

});
