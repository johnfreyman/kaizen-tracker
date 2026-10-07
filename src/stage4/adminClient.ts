// The dashboard uses the coach app's authenticated session in release builds.
// It never creates a second client or reads the privileged summary directly.
export { client as supabase } from './api';
