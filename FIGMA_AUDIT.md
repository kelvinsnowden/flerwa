# Figma Audit

## What was actually checked

The Figma MCP server is connected in this session (tools: `get_design_context`,
`get_screenshot`, `search_design_system`, `use_figma`, `download_assets`,
`get_code_connect_map`, `get_context_for_code_connect`, `export_video`,
`add_code_connect_map`). **Every one of these tools requires a `fileKey`**
(extracted from a `figma.com/design/:fileKey/...` URL) as an input — there is
no "list my files/projects" tool in this set, so the server being connected
does not by itself expose which files exist.

Before writing this document:
- Searched the entire repository (`grep -ri "figma"`) for any stored file key,
  Figma URL, or `.figma`-style config. **Nothing found.**
- Reviewed this session's own conversation history for a previously-shared
  Figma link. **None was shared.**

**Result: no Trusted Services Figma file/node could be identified, so none
of the design-context/screenshot/search tools above were called** — doing so
would require guessing a fileKey, which is not possible (the tool
parameters require a real key, not a search term).

This is the honest state, per the instruction not to claim Figma was used
unless it actually was: **it was not inspected, because no file reference
exists anywhere accessible to this session.**

## What this means for the three-source comparison

Source A (connected Figma) could not be loaded. Sources B and C were used
instead, and are the basis for `MARKETPLACE_UX_AUDIT.md`:

- **Source B**: `/design-references/mobile/01-login.png` and
  `02-otp.png` — the only two files present in that directory. (An earlier
  session's `DESIGN_SYSTEM.md` notes that a fuller reference set was shared
  directly in chat in a prior conversation, not as files on disk — those
  are not recoverable from this session either.)
- **Source C**: the current implementation, reviewed directly.

## To actually complete the Figma audit

Share a Figma file URL (`https://figma.com/design/<fileKey>/...`, ideally
with a `node-id` pointing at the Trusted Services page/frame). Once
provided, this document will be updated with real findings — screens,
components, tokens, and a real Figma-vs-implementation divergence list —
rather than this placeholder.
