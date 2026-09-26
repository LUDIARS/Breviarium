// @implements SPEC-br-web-ui
/**
 * Page CSS, mobile first (320px and up). The document never scrolls sideways; wide tables
 * scroll inside their own box. Tap targets are at least 44px, inputs use 16px text.
 */
export const TAP_PX = 44;
export const INPUT_FONT_PX = 16;

export const STYLE = `
:root { --bg:#f8fafc; --fg:#0f172a; --muted:#475569; --card:#ffffff; --line:#cbd5e1; --accent:#2563eb; --accent-fg:#ffffff; --focus:#f59e0b; --warn:#b45309; --bad:#b91c1c; --ok:#15803d; --tap:${TAP_PX}px;
  --s-not-started:#e2e8f0; --s-in-progress:#bfdbfe; --s-done:#bbf7d0; --s-stale:#fde68a;
  --g-A:#15803d; --g-B:#2563eb; --g-C:#b45309; --g-D:#b91c1c; --g-none:#64748b; }
@media (prefers-color-scheme: dark) { :root { --bg:#0b1120; --fg:#e2e8f0; --muted:#94a3b8; --card:#111827; --line:#334155; --accent:#60a5fa; --accent-fg:#0b1120; --focus:#fbbf24; --warn:#f59e0b; --bad:#f87171; --ok:#4ade80;
  --s-not-started:#1e293b; --s-in-progress:#1e3a8a; --s-done:#14532d; --s-stale:#713f12;
  --g-A:#4ade80; --g-B:#60a5fa; --g-C:#f59e0b; --g-D:#f87171; --g-none:#94a3b8; } }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin:0; font-family: system-ui, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif; font-size:15px; line-height:1.6; background:var(--bg); color:var(--fg); overflow-x:hidden; overflow-wrap:anywhere; }
h1 { font-size:20px; margin:0; } h2 { font-size:18px; margin:0 0 8px; } h3 { font-size:16px; margin:12px 0 6px; }
p { margin:6px 0; }
a { color:var(--accent); }
code { font-size:13px; overflow-wrap:anywhere; word-break:break-all; }
.muted { color:var(--muted); } .warn { color:var(--warn); } .bad { color:var(--bad); } .ok { color:var(--ok); } .small { font-size:13px; }
:focus-visible { outline:3px solid var(--focus); outline-offset:2px; }
.skip-link { position:absolute; left:8px; top:-60px; background:var(--card); padding:8px 12px; z-index:10; }
.skip-link:focus { top:8px; }
.topbar { padding:8px 16px; border-bottom:1px solid var(--line); background:var(--card); display:flex; flex-wrap:wrap; gap:4px 16px; align-items:center; justify-content:space-between; }
.topbar a { display:inline-flex; align-items:center; min-height:var(--tap); }
main { padding:12px 16px 32px; max-width:1200px; margin:0 auto; }
.banner { margin:0 0 12px; padding:10px 12px; border:1px solid currentColor; border-radius:8px; background:var(--card); }
.card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px 16px; margin:0 0 16px; min-width:0; }
.project-list { list-style:none; margin:0; padding:0; display:grid; gap:12px; }
.project-head { display:flex; flex-wrap:wrap; gap:4px 12px; align-items:baseline; }
.project-head a { display:inline-flex; align-items:center; min-height:var(--tap); font-weight:600; font-size:17px; }
.badge { display:inline-block; font-size:12px; border:1px solid currentColor; border-radius:10px; padding:0 8px; }
.stage-bar { list-style:none; margin:8px 0; padding:0; display:grid; grid-template-columns:repeat(9, minmax(0,1fr)); gap:3px; }
.stage-bar li { text-align:center; font-size:12px; padding:4px 0; border-radius:6px; border:1px solid var(--line); min-width:0; overflow:hidden; white-space:nowrap; }
.st-not-started { background:var(--s-not-started); } .st-in-progress { background:var(--s-in-progress); } .st-done { background:var(--s-done); } .st-stale { background:var(--s-stale); }
.legend { font-size:12px; display:flex; flex-wrap:wrap; gap:4px 10px; align-items:center; }
.legend span::before { content:""; display:inline-block; width:12px; height:12px; border-radius:3px; margin-right:4px; vertical-align:middle; border:1px solid var(--line); }
.legend .st-not-started::before { background:var(--s-not-started); } .legend .st-in-progress::before { background:var(--s-in-progress); } .legend .st-done::before { background:var(--s-done); } .legend .st-stale::before { background:var(--s-stale); }
.legend span { background:none; }
.chips { list-style:none; margin:6px 0; padding:0; display:flex; flex-wrap:wrap; gap:4px; }
.chip { display:inline-flex; align-items:center; gap:4px; font-size:12px; border:1px solid var(--line); border-radius:12px; padding:2px 8px; }
.grade { font-weight:700; }
.g-A { color:var(--g-A); } .g-B { color:var(--g-B); } .g-C { color:var(--g-C); } .g-D { color:var(--g-D); } .g-none { color:var(--g-none); }
.timeline { list-style:none; margin:0; padding:0; display:grid; gap:6px; }
.timeline li { border-left:6px solid var(--line); padding:4px 10px; border-radius:4px; background:var(--bg); }
.timeline li.st-not-started { border-left-color:var(--line); background:var(--bg); } .timeline li.st-in-progress { border-left-color:var(--accent); background:var(--bg); } .timeline li.st-done { border-left-color:var(--ok); background:var(--bg); } .timeline li.st-stale { border-left-color:var(--warn); background:var(--bg); }
.table-scroll { overflow-x:auto; max-width:100%; }
table { border-collapse: collapse; width:100%; font-size:13px; }
td, th { border-bottom:1px solid var(--line); padding:6px; text-align:left; vertical-align:top; min-width:5em; }
ul.plain { padding-left:18px; margin:4px 0; }
form { display:grid; gap:10px; margin:8px 0; max-width:640px; }
form.inline { display:inline-block; margin:0; }
label { display:grid; gap:4px; font-weight:600; font-size:14px; }
input, select { font:inherit; font-size:${INPUT_FONT_PX}px; min-height:var(--tap); padding:6px 10px; border:1px solid var(--line); border-radius:8px; background:var(--card); color:var(--fg); max-width:100%; }
button, .button-link { font:inherit; min-height:var(--tap); min-width:var(--tap); padding:0 14px; border:1px solid var(--accent); border-radius:8px; background:var(--accent); color:var(--accent-fg); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; text-decoration:none; }
button.secondary, .button-link.secondary { background:var(--card); color:var(--accent); }
button.danger { background:var(--bad); border-color:var(--bad); color:#fff; }
.actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
details > summary { min-height:var(--tap); display:flex; align-items:center; cursor:pointer; font-weight:600; }
.empty { padding:12px 0; }
.sprint-team { border-top:1px solid var(--line); margin-top:10px; padding-top:6px; min-width:0; }
.bars { display:grid; gap:6px; margin:6px 0; max-width:640px; }
.bar { display:grid; gap:2px; font-size:13px; min-width:0; }
progress { width:100%; max-width:100%; height:12px; accent-color:var(--accent); }
`;
