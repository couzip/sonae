---
name: Add a municipality
about: Request adding a Japanese city to the registry
labels: data, good-first-issue
---

## Municipality

- Name (官報): 例) 大阪市
- 5-digit code: 例) 27100
- Prefecture: 例) 大阪府

## Disaster plan PDF

Direct PDF URL (preferred):
```
https://...
```

Citing page (the HTML page that links the PDF):
```
https://...
```

## Verification

- [ ] PDF is the latest revision available on the official site
- [ ] Note PDF type: text-layer / scanned image / mixed (Sonae handles all
  three; image-only PDFs route through full-OCR via the admin panel)
- [ ] Section title for "被害想定" is consistent with one of: `想定する災害`, `予想される災害`, `被害推計`
