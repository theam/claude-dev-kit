---
name: figma-fetch
description: Extract frame/component structure and all visible text from a Figma design URL. Use whenever a prompt or a fetched issue contains a figma.com/design or figma.com/file link.
---

# Figma Fetch

Pull design context from Figma so the implementation matches the intended UI.

## Trigger

Any URL matching `figma.com/(design|file)/([A-Za-z0-9]+)`.

## How to parse the URL

Given `https://www.figma.com/design/ABcd1234EFgh/My-File?node-id=123-456`:

- **File key**: segment after `/design/` or `/file/` → `ABcd1234EFgh`
- **Node ID**: the `node-id` query param with `-` replaced by `:` → `123:456`

## How to fetch

Use the **Figma MCP** tools to read the file/node. Walk the node tree; collect `TEXT` node content and the name/type of every named node, preserving nesting depth.

If the MCP server is not authenticated, tell the user to authorize the Figma connector (via `/mcp` or their claude.ai connector settings) and stop. Do not invent design content.

## Output format

1. **Node hierarchy** with all text content, indented by depth:

```
===== Figma Node: <name> (<type>) =====
[FRAME] Screen name
  [TEXT] Visible label
  [INSTANCE] ComponentName
    [TEXT] Button copy
```

2. **Plain-English UI summary**: what screens/components are shown, what labels exist, and the apparent layout intent.
3. **Designer notes**: call out any text layers that read as annotations rather than UI copy.

## After fetching

Incorporate the Figma context into the implementation plan before presenting it to the user. When implementing:

- Reuse existing project components first, then the project's UI library, and only then create new components.
- Never use inline styles; follow the project's styling conventions (see the consuming repo's CLAUDE.md).
