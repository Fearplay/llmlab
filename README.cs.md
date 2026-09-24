# LLMLab

Lokální laboratoř pro pochopení a porovnávání jazykových modelů. Píšete skutečným modelům, ukládáte běhy a můžete zkoumat, jak se mění odpovědi při jiném promptu, nastavení, zdrojích nebo agentovi. Na první obrazovce nejsou žádné předstírané výsledky; příklad si načtete sami.

[English](README.md)

## Spuštění bez Dockeru

Potřebujete **Python 3.12+**, **Node.js 22+**, `pnpm`, `uv` a spuštěnou [Ollamu](https://ollama.com/). Ollama je samostatný server. LLMLab ji nespouští a nestahuje modely automaticky.

Pro první lokální pokus stáhněte jeden generativní a jeden embeddingový model:

```powershell
ollama pull qwen3.5:9b
ollama pull all-minilm
python start.py
```

Otevřete **http://127.0.0.1:3000**. API dokumentace je na **http://127.0.0.1:8000/docs**. Příkaz nainstaluje zamknuté projektové závislosti, spustí FastAPI a Next.js a uloží data do `.local-data/lab.sqlite3`. Ukončíte jej `Ctrl+C`. Při nedostupné Ollamě aplikace ukáže její skutečný stav a nebude vymýšlet odpověď.

Vpravo nahoře vyberte některý z dostupných modelů Ollamy. V části **Prompt a tokeny** napište vlastní dotaz a klikněte na **Spustit**. Model, vstup, nastavení, odpověď, čas a nahlášené tokeny najdete v **Historii běhů**.

## Co lze zkoušet

| Část | Co dělá |
| --- | --- |
| Prompt a tokeny | Devět výukových úrovní, systémová instrukce, teplota, top-p, limit výstupu, stop sekvence, JSON schéma a odhad využití kontextu. |
| Aréna modelů | Stejný prompt nad až osmi dostupnými modely, porovnání odpovědí, latence, tokenů a ceny; při referenční odpovědi také objektivní skóre. AI hodnotitel a test pořadí podkladů jsou volitelné. |
| Datasety a evaluátory | Vlastní otázky v CSV/JSON/JSONL, přesná shoda, částečná shoda slov, test podřetězce a JSON schéma. |
| RAG | Vlastní PDF, DOCX, TXT a Markdown soubory, čtyři metody dělení, embeddingy, top-k, BM25 a odkazy na přesné úryvky. Citace nejsou automatický důkaz pravdivosti každého tvrzení. |
| Agenti a bezpečnost | Simulované soubory, databáze a kalkulačka, omezené kroky, režimy paměti, reflexe a uložená stopa. Bezpečnostní pokusy používají falešný klíč a pouze simulované operace. |
| Flappy AI | Hra člověka, náhodného, pravidlového a LLM hráče; vlastní DQN s checkpointem. Žebříček podle seedu, rozhodnutí a replay. |
| Cena a provoz | Grafy běhů a tokenů, modelové součty a odhady z dat poskytovatelů. Neznámá cena zůstane neznámá. |

## Cloudové modely

Klíče OpenAI, Anthropic a Gemini můžete zadat v **Nastavení → Připojení**, nebo do serverového `.env` jako `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`. Klíč se z API neposílá zpět do prohlížeče. Lokální Ollama API klíč nepotřebuje. Na stránce **Poskytovatelé** uvidíte aktuální dostupnost; seznam Ollama modelů vychází z `GET /api/tags`, nikoli z pevného výčtu v aplikaci.

Odhady cen používají pouze ověřené běžné textové API sazby. Může se lišit region, délka kontextu, cache, nástroje, multimédia a skutečná faktura. Aktuální zdroje ceníku: [OpenAI](https://developers.openai.com/api/docs/pricing), [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing), [Gemini](https://ai.google.dev/gemini-api/docs/pricing). Model bez ověřené sazby lze používat, ale jeho cena se nezapočte jako nula.

## Vývoj a ověření

```powershell
pnpm --dir apps/web lint
pnpm --dir apps/web typecheck
pnpm --dir apps/web test
uv run --project apps/api --extra dev pytest -q apps/api/tests
```

Frontend je Next.js 16/React 19, backend FastAPI/SQLAlchemy. Lokální spuštění používá SQLite; Docker Compose zůstává k dispozici pro PostgreSQL a Redis. `start.py` dává při spuštění přednost místní SQLite databázi, i když `.env` obsahuje Docker adresy. Uživatelské dokumenty, epizody a běhy se automaticky nenačítají z jiného projektu.
