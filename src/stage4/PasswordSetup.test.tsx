// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PasswordSetup from './PasswordSetup';
const { getUser, updateUser } = vi.hoisted(() => ({ getUser: vi.fn(), updateUser: vi.fn() }));
vi.mock('./api', () => ({ client: { auth: { getUser, updateUser } } }));
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
    expect(screen.getByText('For new-coach@example.test')).toBeTruthy();
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
    await screen.findByText(/This sign-in has changed/);
    expect(updateUser).not.toHaveBeenCalled(); expect(done).not.toHaveBeenCalled();
  });

});
