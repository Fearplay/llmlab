# LLMLab

Lokální laboratoř pro pochopení a porovnávání jazykových modelů. Píšete skutečným modelům, ukládáte běhy a můžete zkoumat, jak se mění odpovědi při jiném promptu, nastavení, zdrojích nebo agentovi. U polí vidíte krátké příklady; živé volání modelu se spustí až po kliknutí.

[English](README.md)

## Obsah

- [Náhled aplikace](#náhled-aplikace)
- [Instalace nástrojů pro začátečníky](#installation)
- [Stažení LLMLab](#download)
- [Instalace závislostí a první spuštění](#first-start)
- [První experiment](#first-experiment)
- [Řešení častých problémů](#troubleshooting)
- [Volitelné závislosti](#optional-dependencies)
- [Sekce aplikace a AI laboratoře](#sekce-aplikace)
- [Záloha laboratoře](#záloha-laboratoře)
- [Cloudové modely](#cloudové-modely)
- [Vývoj a ověření](#vývoj-a-ověření)
- [Licence a poděkování](#licence)

## Náhled aplikace

Snímky vznikly v čistém profilu prohlížeče s ukázkovým katalogem lokálních modelů a prázdnými seznamy běhů i dokumentů. Neobsahují osobní běhy ani přístupové údaje.

**Přehled:** vstup do laboratoří, uložené běhy, spotřeba tokenů a odhad ceny API.

![Český přehled LLMLab s prázdnou historií běhů](docs/screenshots/overview-cs.png)

**RAG pipeline:** příprava dokumentu, nastavení dělení a modelů, odpověď vedle nalezených podkladů.

![Česká RAG pipeline LLMLab bez nahraných dokumentů](docs/screenshots/rag-cs.png)

<a id="installation"></a>

## Instalace nástrojů pro začátečníky

Instalace má dvě části: nejdřív nástroje do počítače, potom knihovny do tohoto projektu. `start.py` umí automaticky nainstalovat projektové knihovny, ale Python, Node.js, pnpm, uv ani Ollamu za vás nenainstaluje. První instalace a stažení modelů potřebují internet. Pro základní lokální spuštění nepotřebujete Docker, placený API klíč ani samostatnou grafickou kartu; rychlost a nároky modelu závisí na vašem počítači.

### Windows 10/11

Otevřete **Start → PowerShell**. To je terminál, kam vkládáte příkazy, každý řádek zvlášť, a potvrzujete Enterem. Nekopírujte značky ohraničující blok kódu. Následující příkazy jsou určené pro PowerShell.

| Nástroj | K čemu slouží | Jak jej nainstalovat |
| --- | --- | --- |
| Python 3.12+ | Spouští API a soubor `start.py`. | Použijte [instalátor Pythonu](https://www.python.org/downloads/windows/). Pokud nabízí **Add python.exe to PATH**, zaškrtněte tuto volbu. |
| Node.js 22.13+ | Spouští webovou aplikaci; obsahuje také npm. | Použijte [LTS instalátor Node.js](https://nodejs.org/en/download). Ponechte vybranou instalaci npm. |
| uv | Instaluje Python knihovny do odděleného prostředí. | Spusťte příkaz níže; jiné možnosti nabízí [oficiální návod uv](https://docs.astral.sh/uv/getting-started/installation/#winget). |
| pnpm 11.19.0 | Instaluje webové knihovny; verzi určuje `package.json`. | Nainstalujte přes npm příkazem níže. |
| Ollama | Spouští lokální jazykové a embeddingové modely. | Stáhněte a otevřete [Ollamu pro Windows](https://ollama.com/download/windows). Běží samostatně vedle LLMLab. |

Po instalaci Pythonu a Node.js **zavřete PowerShell a otevřete nové okno**. Potom spusťte:

```powershell
winget install --id astral-sh.uv -e
npm.cmd install --global pnpm@11.19.0
```

Pokud nemáte `winget`, použijte jinou možnost z [návodu k instalaci uv](https://docs.astral.sh/uv/getting-started/installation/). Po instalaci znovu zavřete a otevřete PowerShell. Ověřte všechny nástroje:

```powershell
python --version
node --version
npm.cmd --version
pnpm.cmd --version
uv --version
ollama --version
```

Každý příkaz má vypsat verzi, nikoli chybu „příkaz nebyl nalezen“. Python musí mít alespoň verzi 3.12, Node.js alespoň 22.13 a pnpm má mít verzi 11.19.0. Přípona `.cmd` obchází blokování PowerShell skriptů bez změny systémového nastavení.

### macOS a Linux

Nainstalujte [Python 3.12+](https://www.python.org/downloads/), [Node.js 22.13+](https://nodejs.org/en/download), [uv](https://docs.astral.sh/uv/getting-started/installation/) a [Ollamu](https://ollama.com/download) podle návodů pro svůj systém. Potom spusťte `npm install --global pnpm@11.19.0`. V dalších krocích použijte `python3` místo `python` a `pnpm` místo `pnpm.cmd`. Pokud Ollama ještě neběží, nechte v samostatném terminálu spuštěný příkaz `ollama serve`.

<a id="download"></a>

## Stažení LLMLab

Nejjednodušší možnost nevyžaduje Git: na [stránce repozitáře](https://github.com/Fearplay/llmlab) klikněte na **Code → Download ZIP** a ZIP rozbalte. Otevřete rozbalenou složku, ve které jsou soubory `start.py` a `package.json`. Ve Windows napište do adresního řádku Průzkumníka `powershell` a potvrďte Enterem. Terminál se otevře rovnou v této složce.

Pokud už používáte [Git](https://git-scm.com/downloads), můžete místo ZIPu spustit:

```powershell
git clone https://github.com/Fearplay/llmlab.git LLMLab
cd LLMLab
```

Všechny další projektové příkazy spouštějte z této složky. Pokud se repozitář přejmenuje, zkopírujte aktuální adresu přes tlačítko **Code** na GitHubu; místní složka může pořád mít název `LLMLab`.

<a id="first-start"></a>

## Instalace závislostí a první spuštění

Nejdřív otevřete Ollamu. Stáhněte malý generativní model pro odpovědi a embeddingový model pro vyhledávání v dokumentech:

```powershell
ollama pull qwen3.5:2b
ollama pull all-minilm
ollama list
```

Počkejte na dokončení obou stažení. [Qwen3.5 2B](https://ollama.com/library/qwen3.5:2b) je menší první volba než varianta 9B, přesto potřebuje několik GB volného místa a další paměť při běhu. [all-minilm](https://ollama.com/library/all-minilm) je embeddingový model zaměřený na angličtinu: pro české dokumenty zvolte v aplikaci vhodný vícejazyčný embeddingový model. LLMLab nabízí modely, které jsou skutečně dostupné ve vaší Ollamě.

Chcete-li nainstalovat projektové knihovny **ještě před spuštěním**, zadejte:

```powershell
pnpm.cmd install --frozen-lockfile
uv sync --locked --project apps/api --cache-dir .uv-cache
```

První příkaz nainstaluje webové závislosti do `node_modules`. Druhý vytvoří prostředí `apps/api/.venv` a nainstaluje závislosti API. Soubory se zamknutými verzemi vybírají odpovídající balíčky. Nemusíte ručně aktivovat prostředí, instalovat jednotlivé knihovny ani vytvářet `.env` pro základní lokální spuštění.

Spusťte aplikaci:

```powershell
python start.py
```

Spouštěč tyto kontroly závislostí provádí i sám, takže samostatné instalační příkazy jsou volitelné. Nechte terminál otevřený. Až vypíše `LLMLab: http://127.0.0.1:3000`, otevřete v prohlížeči **[LLMLab](http://127.0.0.1:3000)**. **[API dokumentace](http://127.0.0.1:8000/docs)** je volitelná a slouží hlavně vývojářům. Místní záznamy se ukládají do `.local-data/lab.sqlite3`.

Aplikaci ukončíte klávesami **Ctrl+C** v terminálu. Příště stačí otevřít Ollamu, otevřít terminál ve stejné složce projektu a spustit `python start.py`. Stejné modely nemusíte stahovat znovu.

<a id="first-experiment"></a>

## První experiment

1. Vpravo nahoře zvolte **CZ** nebo **EN**.
2. V nabídce modelů vyberte `qwen3.5:2b`.
3. Otevřete **AI laboratoř → Základy → Prompt a tokeny**.
4. Napište `Vysvětli ve třech krátkých větách, co je jazykový model.` a klikněte na **Spustit**.
5. Prohlédněte si odpověď, čas a tokeny. Uložený běh najdete v **Historii běhů**.

Lokální Ollama nepotřebuje API klíč. Pro pochopení jednotlivých pojmů otevřete **AI laboratoř** a vyberte jednu ze čtyř skupin. U polí jsou vysvětlení a příklady.

<a id="troubleshooting"></a>

## Řešení častých problémů

| Co vidíte | Co udělat |
| --- | --- |
| `python`, `node`, `uv` nebo `ollama` nebyl nalezen | Nainstalujte nástroj podle postupu výše a otevřete nový terminál. Pokud `python` otevře Microsoft Store, znovu spusťte instalátor s volbou PATH, nebo zkuste `py -3.12 start.py`, pokud máte Python 3.12. |
| Nelze spustit `npm.ps1` nebo `pnpm.ps1` | Použijte `npm.cmd` / `pnpm.cmd`, stejně jako v příkazech výše. |
| Soubor `start.py` nebo `package.json` nebyl nalezen | Jste v jiné složce. Otevřete rozbalený projekt, nebo použijte `cd "C:\cesta\k\LLMLab"` se svou skutečnou cestou. |
| Instalace závislostí selže nebo se stahování přeruší | Ověřte internet a volné místo, potom zopakujte oba instalační příkazy. Ponechte soubory se zamknutými verzemi; nenahrazujte je náhodnými verzemi balíčků. |
| Port 3000 nebo 8000 je obsazený | Ukončete předchozí LLMLab pomocí Ctrl+C, případně aplikaci používající daný port, a zkuste spuštění znovu. |
| Chybí modely nebo je Ollama nedostupná | Otevřete Ollamu a spusťte `ollama list`. Pokud je seznam prázdný, stáhněte model. V **Poskytovatelích** obnovte katalog. Na macOS/Linuxu podle potřeby spusťte `ollama serve`. |
| Modelu nestačí paměť nebo odpovídá pomalu | Vyberte menší model, zavřete aplikace náročné na paměť a snižte velikost kontextu/výstupu. Větší modely potřebují více RAM/VRAM. |
| RAG nenabízí embeddingový model | Spusťte `ollama pull all-minilm`, obnovte modely a vyberte jej v **RAG pipeline**. Pro české dokumenty použijte vícejazyčný model. |

Pokud spuštění stále selhává, podívejte se na **první chybu v terminálu**. Adresa aplikace začne fungovat až po spuštění webového serveru.

<a id="optional-dependencies"></a>

## Volitelné závislosti

Základní postup stačí pro prompty, porovnání modelů, nahrávání dokumentů a RAG s embeddingy Ollamy. Následující balíčky slouží konkrétním funkcím nebo vývoji; pro první spuštění je nepotřebujete:

| Doplněk | Příkaz ze složky projektu | K čemu slouží |
| --- | --- | --- |
| Python vývojové nástroje | `uv sync --locked --project apps/api --extra dev --cache-dir .uv-cache` | Testy, lint a kontrola typů API. |
| PyTorch trénovací API | `uv sync --locked --project apps/api --extra training --cache-dir .uv-cache` | Volitelný PyTorch trénovací endpoint; velké stažení. Flappy DQN používá NumPy a funguje se základními závislostmi. |
| Lokální sentence-transformers | `uv sync --locked --project apps/api --extra rag --cache-dir .uv-cache` | Volitelný embeddingový backend; nastavení modelu popisuje [vícejazyčný RAG](docs/multilingual-rag.md). |
| Prohlížečové testy | `pnpm.cmd --dir apps/web exec playwright install chromium` | Prohlížeč pro Playwright testy; běžné použití aplikace jej nepotřebuje. |

Doplňky můžete spojit, například `--extra dev --extra training`. Běžný `uv sync` ponechá jen doplňky uvedené v daném příkazu; vždy uveďte všechny, které chcete zachovat. `start.py` již nainstalované doplňky zachovává. Modely stahované Ollamou nebo sentence-transformers mají vlastní licence a nejsou součástí tohoto repozitáře.

## Sekce aplikace

V postranním menu jsou položky v tomto pořadí. **AI laboratoř** má vlastní přehled a čtyři rozbalovací skupiny: **Základy**, **Znalosti a RAG**, **Aplikace** a **Provoz modelů**. **Nastavení** a **Dokumentace** jsou v patičce menu.

| Sekce | Adresa | Co v ní najdete |
| --- | --- | --- |
| Přehled | `/` | Vstup do promptu, arény, RAG a Flappy AI; počty skutečných běhů, tokeny, odhad ceny a poslední uložené běhy. |
| Aréna modelů | `/arena` | Jeden prompt nebo dataset nad několika dostupnými modely; srovnání odpovědí, času, tokenů a odhadované ceny. |
| Datasety | `/datasets` | Ruční tvorba i import případů z CSV, JSON a JSONL, volba kontrol a spuštění vyhodnocení. |
| Prompty | `/prompts` | Ukládání verzí promptů a prohlížení rozdílů mezi nimi. |
| Poskytovatelé | `/providers` | Přehled dostupnosti generativních a embeddingových poskytovatelů a test připojení. |
| Evaluátory | `/evaluators` | Vysvětlení metod skórování a poslední evaluace skutečných odpovědí. |
| AI laboratoř | `/ai-lab` | Výběr pojmu ze čtyř skupin níže; vysvětlení, příklady a experimenty. |
| AI laboratoř → Prompt a tokeny | `/ai-lab/prompt-tokens` | Spouštění promptů se systémovou instrukcí, teplotou, top-p, limitem výstupu, stop sekvencí a podporovaným JSON schématem; odhad i skutečná spotřeba tokenů. |
| AI laboratoř → Embeddingy | `/ai-lab/embeddings` | Převod dvou textů dostupným embeddingovým modelem na vektory a porovnání kosinové podobnosti. |
| AI laboratoř → RAG pipeline | `/ai-lab/rag` | Vložení textu nebo PDF, DOCX, TXT a Markdown souboru; kontrola chunků, indexace, nalezených úryvků, odpovědi a citací. Samotná citace nedokazuje správnost tvrzení. |
| AI laboratoř → Bezpečnost a injection | `/ai-lab/safety` | Vysvětlená galerie podvržených pokynů a tři neškodné testy vlastního systémového promptu. |
| AI laboratoř → Agenti | `/ai-lab/agents` | Simulované nástroje nebo čtení dokumentů a datasetů LLMLab. Každý zápis do dokumentu, datasetu či poznámky čeká na samostatné schválení. |
| AI laboratoř → Flappy AI | `/ai-lab/flappy` | Připravené výzvy a přehrávání rozhodnutí s pauzou, kroky a volbou rychlosti. |
| Kontroly | `/reviews` | Ruční označení uložených odpovědí jako použitelných či nepoužitelných a uložení poznámky k běhu. |
| Historie běhů | `/history` | Uložené běhy, podrobné výsledky a vstup do jejich porovnání. |
| Cena a provoz | `/operations` | Běhy po dnech, tokeny podle modelů, stav poskytovatelů, ceník a známé odhady ceny API. Neznámá cena zůstává neznámá. |
| Nastavení | `/settings` | Místní preference, kontrola dostupnosti API a modelů, úplná záloha a obnova laboratoře. |
| Dokumentace | `/docs` | Vedené mise, mapa pokroku odvozená ze skutečných běhů a slovníček s osobními poznámkami. |

### AI laboratoře

Laboratoře rozlišují vysvětlující výpočty a simulace od skutečných volání modelu. Podrobnosti ukazuje popis a stav běhu v dané laboratoři.

| Skupina | Laboratoře a adresy |
| --- | --- |
| Základy | Tokenizace `/ai-lab/tokenizer`; Transformer `/ai-lab/transformer`; Generování `/ai-lab/generation`; Prompt a tokeny `/ai-lab/prompt-tokens`; Kontext `/ai-lab/context`; Embeddingy `/ai-lab/embeddings`. |
| Znalosti a RAG | Chunking `/ai-lab/chunking`; Vyhledávání `/ai-lab/retrieval`; Reranking `/ai-lab/reranking`; RAG pipeline `/ai-lab/rag`; Kvalita retrievalu `/ai-lab/retrieval-evals`; Grounding `/ai-lab/grounding`. |
| Aplikace | Strukturované výstupy `/ai-lab/structured-output`; Volání nástrojů `/ai-lab/tools`; Agenti `/ai-lab/agents`; MCP `/ai-lab/mcp`; Bezpečnost `/ai-lab/safety`; Flappy AI `/ai-lab/flappy`. |
| Provoz modelů | Směrování modelů `/ai-lab/routing`; Inference `/ai-lab/inference`; Cache `/ai-lab/cache`; KV cache `/ai-lab/kv-cache`; Kvantizace `/ai-lab/quantization`; Fine-tuning `/ai-lab/fine-tuning`. |

## Záloha laboratoře

V **Nastavení → Záloha celé laboratoře** stáhnete verziovaný ZIP s databázovými záznamy, uloženými preferencemi a výukovými poznámkami prohlížeče, dostupnými originály nahraných dokumentů a checkpointem Flappy DQN. API klíče, `.env` a stažené modely se nezahrnují. Po výběru ZIPu se nejprve ověří obsah. Tlačítko **Zálohovat a obnovit** nejdřív stáhne současný stav a potom nahradí místní data. Poškozený archiv se odmítne; při selhání zápisu se databáze vrátí do předchozího stavu. Starší dokument bez uloženého originálu se obnoví z textu a indexu, původní soubor však nebude ke stažení.

Nová API zahrnují `/api/v1/backups/export`, `/inspect`, `/restore`, `/api/v1/preflight`, verze dokumentů pod `/api/v1/user-documents/{id}/versions`, schválení agenta `/api/v1/agent/runs/{id}/approval` a testy promptu `/api/v1/agent/safety/assessments`. Podrobnosti jsou na `http://127.0.0.1:8000/docs`.

Porovnání běhů má vlastní adresu `/experiments/compare`. Starší adresy `/experiments`, `/knowledge-base` a `/ai-lab/training` přesměrovávají do současných sekcí. `/ai-lab/grounding` nyní má vlastní laboratoř.

## Cloudové modely

Klíče OpenAI, Anthropic a Gemini můžete zadat v **Nastavení → Cloudové API klíče**, nebo do serverového `.env` jako `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`. Klíč se z API neposílá zpět do prohlížeče. Lokální Ollama API klíč nepotřebuje. Na stránce **Poskytovatelé** uvidíte aktuální dostupnost; seznam Ollama modelů vychází z `GET /api/tags`, nikoli z pevného výčtu v aplikaci.

Pro server kompatibilní s API OpenAI nastavte v serverovém `.env` `OPENAI_COMPATIBLE_BASE_URL`. Vyžaduje-li server ověření, přidejte `OPENAI_COMPATIBLE_API_KEY` v Nastavení nebo v `.env`.

Odhady cen používají pouze ověřené běžné textové API sazby. Může se lišit region, délka kontextu, cache, nástroje, multimédia a skutečná faktura. Aktuální zdroje ceníku: [OpenAI](https://developers.openai.com/api/docs/pricing), [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing), [Gemini](https://ai.google.dev/gemini-api/docs/pricing). Model bez ověřené sazby lze používat, ale jeho cena se nezapočte jako nula.

## Vývoj a ověření

Nejdřív nainstalujte [základní závislosti](#first-start) a doplněk `dev`. Ve Windows použijte v příkazech níže `pnpm.cmd`, pokud PowerShell blokuje `pnpm.ps1`.

```powershell
pnpm --dir apps/web lint
pnpm --dir apps/web typecheck
pnpm --dir apps/web test
pnpm build
pnpm --dir apps/web exec playwright install chromium
pnpm test:e2e
uv run --project apps/api --extra dev pytest -q apps/api/tests
```

[CI](.github/workflows/ci.yml) při každém pushi a pull requestu spouští lint, kontrolu typů, unit testy, produkční build, Playwright na desktopu, tabletu a mobilu a backendové testy. Test navigace hlídá skupiny, pořadí, názvy, aktivní sekci a dostupnost každé odkazované stránky. Playwright v CI používá produkční build.

Frontend je Next.js 16/React 19, backend FastAPI/SQLAlchemy. Lokální spuštění používá SQLite; Docker Compose zůstává k dispozici pro PostgreSQL a Redis. `start.py` dává při spuštění přednost místní SQLite databázi, i když `.env` obsahuje Docker adresy. Uživatelské dokumenty, epizody a běhy se automaticky nenačítají z jiného projektu.

Opakovatelné pořízení README snímků s ukázkovými API daty a odděleným úložištěm prohlížeče popisuje [postup pro snímky](docs/screenshots/README.md).

## Licence

Vlastní kód LLMLab je pod [licencí MIT](LICENSE). Knihovny třetích stran a fonty IBM Plex mají vlastní podmínky; [poděkování, licenční texty a podmínky další distribuce](THIRD_PARTY_NOTICES.md) odkazují na oznámení pro [web za běhu](THIRD_PARTY_NODE_NOTICES.txt), [webové vývojové nástroje](THIRD_PARTY_NODE_DEV_NOTICES.txt) a [API](THIRD_PARTY_PYTHON_NOTICES.txt). Docker vytváří oznámení pro svou platformu; povinnosti týkající se nativních binárních knihoven a jejich zdrojů popisuje dokument s poděkováním.
