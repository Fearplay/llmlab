# Third-party software and credits

LLMLab's own source is under [MIT](LICENSE). Thank you to the authors and
contributors of the projects below. Each dependency retains its own license;
LLMLab's MIT license does not replace those terms.

## Contents

- [Complete package notices](#complete-package-notices)
- [Main projects](#main-projects)
- [License and attribution requirements](#license-and-attribution-requirements)
- [Native libraries and distribution scope](#native-libraries-and-distribution-scope)
- [Regenerating notices](#regenerating-notices)

## Complete package notices

The audit on 2026-09-28 used the locked Windows x64 installation:

| File | Coverage |
| --- | --- |
| [Web runtime notices](THIRD_PARTY_NODE_NOTICES.txt) | 36 installed production packages, including indirect dependencies and supplied license files for vendored code such as `next/dist/compiled`. |
| [Web development notices](THIRD_PARTY_NODE_DEV_NOTICES.txt) | 458 production and development packages, including required peer dependencies, test, lint, build, and browser automation tools. The runtime packages also appear here. |
| [API notices](THIRD_PARTY_PYTHON_NOTICES.txt) | 64 installed base-environment distributions, their supplied license/NOTICE/copyright files, and PostgreSQL/OpenSSL supplements. Python extras and development packages are included when installed in the environment used to generate this file. |

Each package entry gives its version, declared license, available upstream
source/author metadata, and license texts. Bundled components retain their own
copyright notices inside their parent package's entry. The short table below
is a reading guide; the generated files contain the full package inventory.

Some published npm versions omit a standalone license file. For these, the
generator uses a verified upstream snapshot, the same project's supplied
license, an original source-file license header, or the published README
declaration plus the declared standard license text. These cases are explicitly
labeled; copyright years are not invented. Version-specific fallbacks fail
when the expected package or declaration changes. Snapshot origins and hashes
are recorded in [npm sources](licenses/npm/sources.json) and
[supplemental sources](licenses/supplemental-sources.json).

## Main projects

| Project and contributors | Used for | Declared license; see generated notices for complete terms |
| --- | --- | --- |
| [React](https://github.com/facebook/react), Meta and contributors | UI rendering | MIT |
| [Next.js](https://github.com/vercel/next.js), Vercel and contributors | Web framework | MIT; vendored projects have separate notices |
| [TanStack Query / Table](https://github.com/TanStack), Tanner Linsley and contributors | Data fetching and tables | MIT |
| [Apache ECharts](https://echarts.apache.org/), Apache Software Foundation | Charts | Apache-2.0, including its original NOTICE |
| [echarts-for-react](https://github.com/hustcc/echarts-for-react), hustcc and contributors | React chart integration | MIT |
| [ZRender](https://github.com/ecomfe/zrender), Baidu and contributors | Chart rendering | BSD-3-Clause |
| [Lucide / Feather](https://github.com/lucide-icons/lucide), icon authors and contributors | Icons | ISC; original Lucide and Feather credits retained |
| [IBM Plex](https://github.com/IBM/plex), IBM; [Fontsource](https://github.com/fontsource/fontsource) | Sans and monospace fonts | SIL OFL-1.1 |
| [js-tiktoken](https://github.com/dqbd/tiktoken), tiktoken contributors | Tokenization | MIT |
| [Sharp](https://github.com/lovell/sharp), Lovell Fuller and contributors; [libvips](https://github.com/libvips/libvips) | Framework image processing | Apache-2.0; native libraries include LGPL-3.0-or-later and other licenses |
| [Can I use](https://caniuse.com/), Alexis Deveria and contributors; [caniuse-lite](https://github.com/browserslist/caniuse-lite), Ben Briggs | Browser compatibility data | CC-BY-4.0; LLMLab does not modify the installed package data |
| [FastAPI](https://github.com/fastapi/fastapi), Sebastián Ramírez and contributors | API framework | MIT |
| [Starlette](https://github.com/Kludex/starlette), [Uvicorn](https://github.com/Kludex/uvicorn), and [HTTPX](https://github.com/encode/httpx) contributors | HTTP serving and clients | BSD-3-Clause |
| [SQLAlchemy](https://github.com/sqlalchemy/sqlalchemy) / [Alembic](https://github.com/sqlalchemy/alembic), Michael Bayer and contributors | Database and migrations | MIT |
| [Pydantic](https://github.com/pydantic/pydantic) / pydantic-settings contributors | Validation and settings | MIT |
| [Celery](https://github.com/celery/celery) and contributors; [redis-py](https://github.com/redis/redis-py) contributors | Background jobs and Redis client | BSD-3-Clause / MIT; separate from the Redis server |
| [Psycopg](https://github.com/psycopg/psycopg), the Psycopg team | PostgreSQL adapter | LGPL-3.0-only; binary wheels also bundle native dependencies |
| [PostgreSQL](https://www.postgresql.org/), PostgreSQL Global Development Group and UC Regents; [pgvector-python](https://github.com/pgvector/pgvector-python), Andrew Kane | Native libpq client and vector types | PostgreSQL License / MIT |
| [NumPy](https://github.com/numpy/numpy), NumPy developers; [Pillow](https://github.com/python-pillow/Pillow), Pillow/PIL contributors | Numerical computations, Flappy DQN, and images | BSD-3-Clause with bundled notices / MIT-CMU with bundled notices |
| [pypdf](https://github.com/py-pdf/pypdf), [python-docx](https://github.com/python-openxml/python-docx), and [lxml](https://github.com/lxml/lxml) contributors | Document parsing | BSD-3-Clause / MIT / BSD-3-Clause, with native-library notices where supplied |
| [jsonschema](https://github.com/python-jsonschema/jsonschema), [keyring](https://github.com/jaraco/keyring), and [PyYAML](https://github.com/yaml/pyyaml) contributors | Schemas, credential storage, and YAML | MIT |
| [python-multipart](https://github.com/Kludex/python-multipart) contributors | File uploads | Apache-2.0 |
| [OpenSSL](https://github.com/openssl/openssl), OpenSSL Project Authors | TLS libraries bundled with psycopg-binary | Apache-2.0 for the audited OpenSSL 3.x library |
| [TypeScript](https://github.com/microsoft/TypeScript), [ESLint](https://github.com/eslint/eslint), [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss), [Vitest](https://github.com/vitest-dev/vitest), [Testing Library](https://github.com/testing-library), [Playwright](https://github.com/microsoft/playwright) | Development, styling, lint, and tests | Apache-2.0 / MIT / MIT / MIT / MIT / Apache-2.0, plus each project's bundled components |

## License and attribution requirements

- MIT, ISC, BSD and similar licenses require retaining their supplied copyright,
  permission/conditions, and disclaimer texts. Keep the generated notices with
  redistributed packages/builds; a list of project names alone is insufficient.
- [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) requires its license
  and applicable NOTICE attributions. The original ECharts NOTICE is reproduced
  in the web notices. Mark modifications to third-party files when applicable.
- [SIL OFL-1.1](https://openfontlicense.org/open-font-license-official-text/)
  governs the IBM Plex font files. Preserve their copyright and OFL text;
  modified fonts must also meet the reserved-name terms.
- [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.en) governs
  caniuse-lite data. The notices identify the creators, original source, license,
  and LLMLab's unchanged use of the installed data.
- Psycopg and some native image libraries use LGPL. Copies of
  [LGPL 3.0](licenses/LGPL-3.0.txt) and its incorporated
  [GPL 3.0](licenses/GPL-3.0.txt) are included. Binary distribution also needs
  the applicable source/replacement or relinking provisions; license text and
  credits alone do not discharge those obligations.

## Native libraries and distribution scope

The Git repository does not include `node_modules`, Python environments, model
weights, or built containers. People installing from source obtain these
packages from their original distributors. The notices above audit the
installed package graph and supplied files; they are not a certification of
every component statically linked into a native binary.

Sharp's matching [sharp-libvips 1.3.3 component list](licenses/sharp-libvips-1.3.3-THIRD-PARTY-NOTICES.md)
is included with the web notices. [Its source and build recipes](https://github.com/lovell/sharp-libvips/tree/v1.3.3)
identify components and replacement builds. Native versions are also recorded
in the installed `@img/sharp-*/versions.json`. This upstream component list is
an index of licenses, not the complete copyright/license text of every native
library. Before distributing a binary or container, include the corresponding
native sources and their full notices required by the applicable terms.

The audited Windows `psycopg-binary` wheel contains libpq **18.4** and OpenSSL
**3.6.3**, checked against the loaded libraries. Their original PostgreSQL
COPYRIGHT, OpenSSL copyright header, and Apache license are now included in the
API notices. [Psycopg source/build recipes](https://github.com/psycopg/psycopg/tree/3.3.5),
[PostgreSQL source archives](https://www.postgresql.org/ftp/source/), and
[OpenSSL sources](https://github.com/openssl/openssl) support rebuilding.
Different wheels can include additional libraries and versions; audit those
actual artifacts and retain their own notices/source provisions too.

Linux/macOS packages, optional PyTorch/sentence-transformers installations,
Ollama and downloaded models, browser binaries, and Docker base-image/system
packages have separate inventories. Docker builds regenerate application
package notices for their installed environment. They do not automatically
collect all native source trees or base-image license obligations. Preserve
base-image notices and regenerate/audit the actual distribution before publishing
it. API client libraries are separate from service/server and model licenses.

## Regenerating notices

Run from the repository root after changing a lockfile. On Windows use
`pnpm.cmd` if PowerShell blocks `pnpm.ps1`:

```powershell
pnpm.cmd install --frozen-lockfile
node scripts/generate-node-notices.mjs --output THIRD_PARTY_NODE_NOTICES.txt
node scripts/generate-node-notices.mjs --include-dev --output THIRD_PARTY_NODE_DEV_NOTICES.txt
uv sync --locked --project apps/api --cache-dir .uv-cache
uv run --project apps/api --no-sync python apps/api/scripts/generate_notices.py --output THIRD_PARTY_PYTHON_NOTICES.txt
```

For API development or optional extras, synchronize the desired environment
first, for example `uv sync --locked --project apps/api --extra dev --extra training --extra rag --cache-dir .uv-cache`, then regenerate the API notices with
`--no-sync`. That records packages actually installed, including extras.
It is unnecessary to download all extras for the base installation.

The generators fail for unhandled packages without license text. Extend
version-specific fallbacks using original source/declarations when necessary;
do not silence the error or guess a package's license. Review changes, bundled
components, source availability, and the selected platform before distributing
the resulting artifact.
