import markdown, re, html, pathlib, datetime

DOCS = [
    ("00-executive-summary.md",      "Executive Summary"),
    ("01-global-market-research.md", "The Global Market"),
    ("02-africa-kenya-landscape.md", "Africa and Kenya"),
    ("03-marketplace-definition.md", "Defining the Marketplace"),
    ("04-economics-and-pricing.md",  "Marketplace Economics"),
    ("05-payments-mpesa.md",         "Payment Infrastructure"),
    ("06-trust-reputation-fraud.md", "Trust, Reputation, Disputes, Fraud"),
    ("07-product-spec.md",           "Product Specification"),
    ("08-ai-matching.md",            "AI Matching and Campaign Builder"),
    ("09-workflow-states.md",        "The Campaign Workflow"),
    ("10-technical-architecture.md", "Technical Architecture"),
    ("11-analytics-metrics.md",      "Analytics and Metrics"),
    ("12-gtm-liquidity-growth.md",   "Liquidity, Launch and Growth"),
    ("13-legal-compliance.md",       "Legal and Regulatory Surface"),
    ("14-roadmap-mvp.md",            "MVP, Roadmap, Launch Campaigns"),
    ("15-investor-case-and-risks.md","Investor Case and Failure Modes"),
    ("16-blueprint-and-decisions.md","Blueprint, Wedge, Founder Brief"),
    ("sources.md",                   "Sources"),
]

md = markdown.Markdown(extensions=["tables", "fenced_code", "sane_lists", "attr_list"])

def badge(m):
    kind = m.group(1); rest = m.group(2) or ""
    cls = {"FACT":"b-fact","REC":"b-rec","ASSUMPTION":"b-assume"}[kind]
    return f'<span class="badge {cls}">{kind}{html.escape(rest)}</span>'

sections = []
for i, (fn, title) in enumerate(DOCS):
    raw = pathlib.Path("docs", fn).read_text()
    # Drop the file's own H1 — the section title page supplies it
    raw = re.sub(r"\A#\s+.*?\n", "", raw, count=1)
    md.reset()
    body = md.convert(raw)
    # Style the FACT / REC / ASSUMPTION taxonomy as badges
    body = re.sub(r"\[(FACT|REC|ASSUMPTION)(\s*[—-][^\]]*)?\]", badge, body)
    num = "00" if i == 0 else (f"{i:02d}" if fn != "sources.md" else "—")
    sections.append({"id": f"sec{i}", "num": num, "title": title, "body": body})

toc = "\n".join(
    f'<li><a href="#{s["id"]}"><span class="tnum">{s["num"]}</span>'
    f'<span class="ttitle">{html.escape(s["title"])}</span></a></li>'
    for s in sections
)

body_html = "\n".join(
    f'<section class="doc" id="{s["id"]}">'
    f'<header class="sechead"><div class="secnum">{s["num"]}</div>'
    f'<h1>{html.escape(s["title"])}</h1></header>{s["body"]}</section>'
    for s in sections
)

today = datetime.date(2026, 9, 8).strftime("%d %B %Y")

CSS = """
@page { size: A4; margin: 16mm 15mm 20mm 15mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: "DejaVu Serif", Georgia, serif; font-size: 9.6pt; line-height: 1.52;
       color: #14181C; margin: 0; }
h1,h2,h3,h4,.sans { font-family: "DejaVu Sans", Helvetica, Arial, sans-serif; }

/* ---------- cover ---------- */
.cover { height: 251mm; display: flex; flex-direction: column; justify-content: space-between;
         page-break-after: always; }
.cover .rule { height: 5px; background: #0A6E5C; width: 64mm; }
.cover h1 { font-size: 36pt; line-height: 1.04; margin: 10mm 0 0; letter-spacing: -0.5px; color:#0d1117; }
.cover .sub { font-size: 14.5pt; color: #3c4650; margin-top: 6mm; line-height: 1.4; max-width: 128mm;
              font-family: "DejaVu Serif", Georgia, serif; }
.cover .kicker { font-size: 9.5pt; letter-spacing: 2.4px; text-transform: uppercase;
                 color: #0A6E5C; font-weight: bold; }
.cover .meta { font-size: 8.6pt; color: #55606b; border-top: 1px solid #d8dde1; padding-top: 5mm; }
.cover .meta b { color:#14181C; }
.legend { display:flex; gap:5mm; margin: 7mm 0 4mm; flex-wrap: wrap; }
.findings { border-left: 3px solid #0A6E5C; padding-left: 6mm; max-width: 150mm; }
.findings .fh { font-family:"DejaVu Sans",sans-serif; font-size: 8.4pt; letter-spacing: 1.8px;
                text-transform: uppercase; color: #0A6E5C; font-weight: bold; margin-bottom: 4mm; }
.findings .fitem { font-size: 9.4pt; line-height: 1.5; color: #29323b; margin-bottom: 3.4mm; }
.findings .fitem b { color: #0d1117; }

/* ---------- contents ---------- */
.contents { page-break-after: always; }
.contents h2 { font-size: 17pt; border-bottom: 2px solid #0A6E5C; padding-bottom: 3mm; margin-top:0; }
.contents ol { list-style: none; padding: 0; margin: 8mm 0 0; }
.contents li { margin-bottom: 3.1mm; }
.contents a { text-decoration: none; color: #14181C; display: flex; gap: 6mm; align-items: baseline;
              border-bottom: 1px dotted #ccd3d8; padding-bottom: 2.4mm; }
.tnum { font-family:"DejaVu Sans",sans-serif; font-size: 8.5pt; color: #0A6E5C; font-weight: bold;
        min-width: 9mm; }
.ttitle { font-size: 10.6pt; }

/* ---------- section heads ---------- */
.doc { page-break-before: always; }
.sechead { border-bottom: 2.5px solid #0A6E5C; margin-bottom: 7mm; padding-bottom: 3mm; }
.secnum { font-family:"DejaVu Sans",sans-serif; font-size: 8.5pt; letter-spacing: 2.2px;
          color: #0A6E5C; font-weight: bold; }
.sechead h1 { font-size: 23pt; margin: 1.5mm 0 0; line-height: 1.16; letter-spacing:-0.3px; }

h2 { font-size: 13.4pt; margin: 8mm 0 2.6mm; padding-bottom: 1.6mm; border-bottom: 1px solid #dde2e6;
     page-break-after: avoid; line-height:1.25; }
h3 { font-size: 11.1pt; margin: 6mm 0 2mm; color: #17324a; page-break-after: avoid; line-height:1.3; }
h4 { font-size: 9.9pt; margin: 4.5mm 0 1.6mm; color: #3c4650; page-break-after: avoid; }
p { margin: 0 0 2.9mm; orphans: 2; widows: 2; }
ul,ol { margin: 0 0 3mm; padding-left: 6mm; }
li { margin-bottom: 1.5mm; }
strong { color: #000; }
hr { border:0; border-top:1px solid #e1e6ea; margin: 6mm 0; }
a { color: #0A5C6E; text-decoration: none; }

blockquote { margin: 4mm 0; padding: 3.4mm 5mm; background: #f4f8f7;
             border-left: 3.5px solid #0A6E5C; page-break-inside: avoid; }
blockquote p:last-child { margin-bottom: 0; }
blockquote h2, blockquote h3 { margin-top:0; border:0; }

/* ---------- tables ---------- */
table { width: 100%; border-collapse: collapse; margin: 3.5mm 0 5mm; font-size: 8.5pt;
        font-family:"DejaVu Sans",sans-serif; page-break-inside: auto; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
th { background: #12313f; color: #fff; text-align: left; padding: 2mm 2.2mm; font-size: 8pt;
     line-height:1.3; vertical-align: bottom; }
td { padding: 1.9mm 2.2mm; border-bottom: 1px solid #e4e9ed; vertical-align: top; line-height: 1.38; }
tbody tr:nth-child(even) td { background: #f8fafb; }

/* ---------- code ---------- */
pre { background: #f6f8f9; border: 1px solid #e2e8ec; border-left: 3px solid #8fa3ae;
      padding: 3mm 3.5mm; font-family: "DejaVu Sans Mono", monospace; font-size: 8pt;
      line-height: 1.36; overflow: hidden; page-break-inside: avoid; margin: 3.5mm 0 5mm;
      white-space: pre; }
code { font-family: "DejaVu Sans Mono", monospace; font-size: 0.87em; background: #eef2f4;
       padding: 0.4mm 1mm; border-radius: 2px; }
pre code { background: none; padding: 0; font-size: inherit; }

/* ---------- badges ---------- */
.badge { font-family:"DejaVu Sans",sans-serif; font-size: 6.8pt; font-weight: bold;
         letter-spacing: 0.5px; padding: 0.5mm 1.4mm; border-radius: 2px; white-space: nowrap;
         vertical-align: 0.4mm; }
.b-fact   { background: #d8efe2; color: #0d5d38; }
.b-rec    { background: #dbe8f7; color: #16456f; }
.b-assume { background: #fbeed5; color: #7a5310; }
"""

OUT = f"""<!doctype html><html><head><meta charset="utf-8">
<title>Flerwa — Creator Collaboration Marketplace</title><style>{CSS}</style></head><body>

<div class="cover">
  <div>
    <div class="rule"></div>
    <h1>Flerwa</h1>
    <div class="kicker" style="margin-top:5mm">Creator Collaboration Marketplace</div>
    <div class="sub">A strategy, product and technical blueprint for a creator–brand
    marketplace launching in Kenya, built on M-Pesa, designed to expand across East Africa.</div>
  </div>
  <div class="findings">
    <div class="fh">The three findings that shape this plan</div>
    <div class="fitem"><b>1 &nbsp;The market as framed is too small.</b> Kenya's measured influencer
      advertising market is <b>US$2.1M (2024) → US$3.0M (2028)</b>. Capturing <i>all</i> of it at a 15%
      take rate yields ~US$315k a year. The plan must target content-production, SME marketing,
      regional and export budgets instead.</div>
    <div class="fitem"><b>2 &nbsp;The core product already exists.</b> Zaumu launched in Nairobi in
      April 2025 with escrow, milestone payments, creator-protective contracts and two-sided reviews.
      Differentiation must be category, average order value and operational reliability — not escrow.</div>
    <div class="fitem"><b>3 &nbsp;Order value matters more than take rate.</b> Doubling average order
      value from KSh 10,000 to KSh 20,000 more than <b>triples</b> gross profit, because operations
      and payout costs are charged per order, not per shilling.</div>
  </div>
  <div>
    <div class="legend">
      <span class="badge b-fact">FACT</span>
      <span class="badge b-rec">RECOMMENDATION</span>
      <span class="badge b-assume">ASSUMPTION</span>
    </div>
    <div class="meta">
      Every claim in this document is tagged <b>FACT</b> (verified and cited),
      <b>RECOMMENDATION</b>, or <b>ASSUMPTION</b> (estimate, unverified).
      All sources are listed in the final section.<br><br>
      Research conducted <b>{today}</b> &nbsp;·&nbsp; 18 sections &nbsp;·&nbsp;
      Covering all 50 parts of the brief<br>
      <b>This document is not legal, tax, or financial advice.</b>
      Regulatory sections identify areas requiring professional Kenyan counsel.
    </div>
  </div>
</div>

<div class="contents">
  <h2>Contents</h2>
  <ol>{toc}</ol>
</div>

{body_html}
</body></html>"""

pathlib.Path("build/flerwa.html").write_text(OUT)
print("html written:", len(OUT), "bytes;", len(sections), "sections")
