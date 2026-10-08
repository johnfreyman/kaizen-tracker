#!/usr/bin/env node
// PreToolUse guard for Supabase MCP tools (owner choice, 2026-09-24).
// - Stage 3 test project: approve without a prompt.
// - Live Kaizen project: block; it needs a separate release authorization.
// - Anything else (no project ID, another project): no decision here, so the
//   normal permission prompt and rules apply.
const TEST_PROJECT = 'viouquduxutuslafiooy';
const LIVE_PROJECT = 'pwgqwcvultxihntvaewo';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  raw += chunk;
});
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return; // Unreadable input: leave the decision to the normal prompt.
  }
  const tool = typeof input?.tool_name === 'string' ? input.tool_name : '';
  const args = input?.tool_input ?? {};
  // get_project names its project "id"; the other project tools use "project_id".
  const project = args.project_id ?? (/__get_project$/.test(tool) ? args.id : undefined);

  let decision;
  let reason;
  if (project === TEST_PROJECT) {
    decision = 'allow';
    reason = 'Stage 3 isolated test project: approved by the repository hook.';
  } else if (project === LIVE_PROJECT) {
    decision = 'deny';
    reason = 'Live Kaizen project: blocked. It needs a separate release authorization.';
  } else {
    return;
  }
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  }));
});
