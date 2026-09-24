# Third-party software

LLMLab's own source is under [LICENSE](LICENSE). Dependencies keep their own
licenses; the MIT license for LLMLab does not replace them.

- [Web production package notices](THIRD_PARTY_NODE_NOTICES.txt) contain the
  package versions, license identifiers, copyright and license text, and any
  supplied NOTICE files from the installed dependency graph. This includes the
  IBM Plex fonts under SIL OFL 1.1 and Apache ECharts under Apache 2.0.
- [API production package notices](THIRD_PARTY_PYTHON_NOTICES.txt) contain the
  corresponding files from the installed Python environment. This includes
  psycopg and psycopg-binary under LGPL 3.0.
- [GNU GPL 3.0](licenses/GPL-3.0.txt) and
  [GNU LGPL 3.0](licenses/LGPL-3.0.txt) are included for libraries that use
  LGPL 3.0. The LGPL incorporates the terms of GPL 3.0.
- The installed Sharp binary may contain libvips and other native libraries.
  The matching [sharp-libvips 1.3.3 third-party list](licenses/sharp-libvips-1.3.3-THIRD-PARTY-NOTICES.md)
  is included. Its [source and build scripts](https://github.com/lovell/sharp-libvips/tree/v1.3.3)
  document the native components and allow a replacement build.
- `caniuse-lite` data is credited to Ben Briggs, with its source and unchanged
  status recorded beside its CC BY 4.0 license in the web notices.

The checked-in notice files reflect the locked dependencies installed on a
Windows development machine. Platform-specific packages differ on Linux and
macOS. The web and API Docker builds regenerate notices from the packages
actually installed in each image. Keep those generated files with any binary
or container distribution.

After changing either lockfile, regenerate the checked-in files with:

```powershell
pnpm install --frozen-lockfile
node scripts/generate-node-notices.mjs --output THIRD_PARTY_NODE_NOTICES.txt
uv sync --project apps/api --locked
uv run --project apps/api --no-sync python apps/api/scripts/generate_notices.py --output THIRD_PARTY_PYTHON_NOTICES.txt
```

For optional Python extras such as `training` and `rag`, regenerate the API
notices in the environment that includes those extras. The API Docker build
installs `training` and performs that step automatically.
