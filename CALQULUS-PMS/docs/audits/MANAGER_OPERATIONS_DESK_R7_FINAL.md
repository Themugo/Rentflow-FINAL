# Manager Operations Desk R7 — final compile cleanup

Base: b7c1b04a465df2e00163e9087b66242e8213580d

Fixed the last AgencyOperationsCenter defaults-panel TypeScript inference issue by reusing the
existing strongly typed DEFAULT_TOGGLES constant instead of re-declaring the toggle tuple inline.

No business flow or data model was changed.
