# TODO: URL-Compressed Text Storage

Explore storing compressed raw text directly in URL links (e.g. hash fragment `#text=...`) so users can share custom text/markdown word clouds without requiring a Google Doc backend.

---

## 1. Concept

Allow sharing of custom text / markdown documents directly in the URL:
- Use native browser `CompressionStream('deflate-raw')` + Base64URL encoding.
- Place payload in the URL hash fragment (`#text=...`) rather than query parameters (`?text=...`) so large strings are never sent across the network to servers/CDNs (avoiding HTTP 414 / 431 header limits).

---

## 2. Technical Design

### A. Compression & Decompression Utilities
- **Algorithm**: `deflate-raw` via native `CompressionStream` and `DecompressionStream` (zero container overhead, supported in modern Chromium, Safari 16.4+, Firefox 113+).
- **Encoding**: Base64URL (`-`, `_`, unpadded) to avoid percent-encoding inflation.
- **Threshold Fallback**: For short text (< 80 chars), DEFLATE Huffman trees can expand the text; prefix with a version/mode tag (e.g., `c.` for compressed, `r.` for raw URI-encoded).

```typescript
// Proposed helpers
export async function compressTextToUrlSafe(text: string): Promise<string> {
  const stream = new Blob([text])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  const buffer = await new Response(stream).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function decompressTextFromUrlSafe(base64url: string): Promise<string> {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}
```

### B. URL Schema
- Store in hash fragment alongside existing metadata:
  ```
  https://example.com/wordcloudy/#title=Notes&attribution=Author&date=2026&text=c.<base64url>
  ```
- Keep Google Doc URLs in query parameters (`?doc=...`) to ensure backward compatibility with existing links (as specified in `CLAUDE.md`).

---

## 3. Implementation Checklist

- [ ] **Utility Implementation**: Add `compressTextToUrlSafe` and `decompressTextFromUrlSafe` to `src/sections.ts` (or dedicated utility module).
- [ ] **URL Extraction**: Update URL parser in `src/sections.ts` to inspect `window.location.hash` for compressed text when query parameter `doc` is absent.
- [ ] **Share Button Integration**: Enable the "Share" button for text documents when compressed payload fits reasonable link size limits (< 4–8 KB).
- [ ] **Copy Link Behavior**: Construct shareable URL with hash fragment for local text documents; display character count/warning if text exceeds recommended link size.
- [ ] **Compatibility Check**: Ensure existing Google Doc share URL format (`?doc=...&title=...&attribution=...&date=...`) remains unaffected.
- [ ] **Automated Tests**: Unit test round-trip compression/decompression across short, medium, and markdown text with unicode/punctuation.
