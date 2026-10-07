// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PasswordSetup from './PasswordSetup';
const { updateUser } = vi.hoisted(() => ({ updateUser: vi.fn() }));
vi.mock('./api', () => ({ client: { auth: { updateUser } } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('password setup from invite/recovery links', () => {
  it('does not submit mismatched confirmation', () => {
    render(<PasswordSetup onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'invented-fixture-only' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'different-fixture-only' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save password' }).closest('form')!);
    expect(updateUser).not.toHaveBeenCalled(); expect(screen.getByRole('alert').textContent).toContain('must match');
  });
  it('keeps the form open and displays a rejected password', async () => {
    updateUser.mockResolvedValue({ error: new Error('Password rejected') });
    const done = vi.fn(); render(<PasswordSetup onComplete={done} onCancel={vi.fn()} />);
    for (const label of ['New password', 'Confirm password']) fireEvent.change(screen.getByLabelText(label), { target: { value: 'invented-fixture-only' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save password' }).closest('form')!);
    await screen.findByText('Password rejected'); expect(done).not.toHaveBeenCalled();
  });
});
