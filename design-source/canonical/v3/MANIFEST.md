# SHAGGY Dream v3 Canonical Design Source

## Golden Frame 01

- File: `Golden-Frame-01.png`
- Role: immutable pixel authority for the Dream v3 Command Center
- Width: 1536 px
- Height: 1024 px
- Bytes: 1,911,686
- SHA-256: `238a051d8c2fe3ce6e8021822770895f4c46bb6667fc93c2bd5b08428dd3ae76`
- Original attachments:
  - `.hermes/desktop-attachments/Generated image 1.png`
  - `.hermes/desktop-attachments/Generated image 1 (1).png`

Both original attachments were verified byte-identical before this canonical copy was created.

## Contract

Run:

```bash
pnpm verify:golden-frame
```

The verifier reads the PNG IHDR dimensions and checks dimensions, byte length and SHA-256. Any mismatch fails the visual authority gate.

Do not edit or optimize the canonical PNG. Derived/compressed assets must use a different filename outside this directory.
