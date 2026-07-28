# Multiplayer member identity and two-web verification

## Goal

Two independent Web pages must create and join the same room, and both pages must show exactly the authoritative room members. Each member needs a human-readable English guest name and a clear `You`/`Guest` role without exposing player IDs as names.

## Implementation order

1. Add failing backend contract tests for `display_name` in room snapshots and realtime updates.
2. Add failing mobile tests for random guest names, member role labels, no player-ID rendering, and two-member realtime updates.
3. Add `display_name` to backend room members and mobile room/realtime mapping.
4. Generate a random English guest name for the guest entry flow; render bounded one-line names with explicit role labels in Waiting and Live.
5. Run backend tests, mobile tests/typecheck/lint, then repeat the two-Web-page create/join flow on a fresh room and record both page states.

## Constraints

- Preserve the existing dirty worktrees; do not reset, checkout, commit, push, deploy, or delete existing rooms.
- Keep room membership authoritative from the backend and deduplicate by `player_id` in the client mapping.
- Never render `player_id` as a user-facing name.
