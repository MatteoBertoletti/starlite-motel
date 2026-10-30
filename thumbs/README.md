# Copertine (thumbs)

Questa sezione produce le copertine YouTube dei video, nello stile dei canali di riferimento
(Final Sight, Bradikinin, CastVenk): sfondo nero o rosso pieno, un comando di 2-3 parole con una parola in rosso,
un solo soggetto grande, tagliato dal bordo.

L'idea è dividere il lavoro: **l'arte** (personaggi, oggetti) sta in un *kit* di PNG che si può migliorare con l'AI,
**testo e impaginazione** li fa il codice, così font, alone e posizioni restano identici in ogni copertina.

```
episodes/<ep>/thumbs.json  ──┐
thumbs/templates/*.html    ──┼──► tools/thumb.py ──► out/thumbs/<ep>/<variante>.jpg   (1280x720, sotto 2 MB)
thumbs/kit/*.png (l'arte)  ──┘
        ▲
        └── tools/thumb_art.py (Kie.ai) propone candidati; scegli il migliore e lo copi nel kit
```

## Uso rapido

```bash
npm ci                                        # una volta: installa i font del video (Montserrat, JetBrains Mono)
pip install playwright pillow && python -m playwright install chromium
python tools/thumb.py --ep ep01_citofono      # monta le 3 copertine di Il Citofono in out/thumbs/ep01_citofono/
```

Senza lanciare nulla in locale: **Actions → thumbs → Run workflow** (modalità `compose`), poi scarichi l'artifact.

## Cartelle

| Percorso | Cosa contiene |
| --- | --- |
| `thumbs/styles.json` | Palette, regole di stile, prompt e modelli per l'AI |
| `thumbs/kit/` | L'arte approvata: PNG trasparenti (`double_grin`, `double_red`, `you_scared`, `intercom`, `videophone`) |
| `thumbs/templates/` | I tre template: `black_number`, `red_arrow`, `black_monster` |
| `episodes/<ep>/thumbs.json` | Le varianti di quell'episodio: template e testi |
| `tools/thumb.py` | Compone le copertine |
| `tools/thumb_kit.py` | Ricrea il kit base disegnato in vettoriale |
| `tools/thumb_art.py` | Chiede a Kie.ai candidati di arte per il kit |
| `tools/test_thumb_art.py` | Prova del client Kie su un finto server (senza rete né chiave) |
| `.github/workflows/thumbs.yml` | Lancia tutto da GitHub |

## I tre template

| Template | Aspetto | Testi (`text`) | Arte usata |
| --- | --- | --- | --- |
| `black_number` | Nero, comando in alto, numero rosso dentro l'oggetto (come il "101%" nella batteria di Bradikinin) | `white`, `red`, `number` | `videophone` |
| `red_arrow` | Rosso pieno, parola grande bianca e piccola nera, freccia verso una cornice con il mostro (come Final Sight) | `big`, `small`, `cam` | `double_grin` |
| `black_monster` | Nero, comando in alto, persona che suda e mostro nello schermo del citofono con onde rosse (come CastVenk) | `white`, `red` | `you_scared`, `double_red`, `intercom` |

## Nuova copertina per un nuovo episodio

Crea `episodes/<ep>/thumbs.json`:

```json
{ "variants": [
  { "id": "1_nero_numero", "template": "black_number", "text": { "white": "NON", "red": "APRIRE", "number": "03:10" } },
  { "id": "3_nero_mostro", "template": "black_monster", "text": { "white": "È LA TUA", "red": "PORTA" } }
] }
```

Poi `python tools/thumb.py --ep <ep>`. Il testo viene adattato da solo alla larghezza del template.
Regole che rendono una copertina simile a quelle dei competitor (sono anche in `thumbs/styles.json`):

- comando di 2-3 parole, **una sola parola in rosso**, tutto maiuscolo;
- **un solo soggetto**, grande, tagliato dal bordo; nessun testo piccolo;
- sfondo nero puro oppure rosso pieno;
- il testo ripete il comando del titolo o apre una domanda: non aggiunge un'altra frase;
- si deve leggere a circa 170×95 pixel (come nei suggeriti sul telefono).

## Migliorare l'arte con l'AI (Kie.ai)

L'arte del kit è disegnata in vettoriale: pulita ma piatta. Per avvicinarsi ai competitor (contorni spessi, volti più
espressivi, luce) si sostituiscono i PNG del kit con arte generata e scelta a mano.

1. **Actions → thumbs → Run workflow**: `mode = art`, `asset = double_grin` (o `double_red`, `you_scared`), `n = 4`.
2. Il workflow usa il secret **`KIE_AI_API`** (Settings → Secrets and variables → Actions) e il modello di
   `thumbs/styles.json` (`nano-banana-2`). L'immagine attuale del kit viene passata come riferimento.
3. Scarica l'artifact `thumbs_art`: per ogni candidato trovi `NN.png`, `NN_cut.png` (sfondo magenta tolto) e `sheet.jpg`.
4. Scegli il migliore, ripulisci i bordi se serve, copialo in `thumbs/kit/<asset>.png` e fai commit.
5. Rilancia `compose`: tutte le copertine usano la nuova arte.

Due leve per cambiare il risultato (anche come ingressi del workflow):

- **`ref`** (`--no-ref` in locale): con `true` il kit attuale è il riferimento e i candidati gli assomigliano molto, quindi sono puliti ma
  poco diversi; con `false` il modello ha più libertà e sono più espressivi, ma meno coerenti col personaggio.
- **`extra`** (`--extra "..."`): testo aggiunto al prompt, per esempio `exaggerated menacing expression, huge grin`.

In locale: `KIE_API_KEY=... python tools/thumb_art.py --asset double_grin --n 4`
(con `--dry-run` stampa solo il prompt e la richiesta, senza chiamare l'API).

Consigli: tieni lo **stesso stile** fra gli asset (stesso prompt di base in `styles.json`), cambia pochi dettagli alla volta,
e guarda sempre il risultato a dimensione piccola. L'AI sbaglia spesso la coerenza fra immagini diverse: per questo si sceglie
a mano e si salva nel kit, invece di rigenerare ogni volta. Per formato o proporzioni diverse, aggiungi un asset in `styles.json`.

## Costi e limiti (Kie.ai)

- Nel test con `nano-banana-2` a 1K sono stati 8 crediti per immagine.
- Si paga a crediti per immagine; il prezzo cambia per modello, controlla [kie.ai/pricing](https://kie.ai/pricing).
  Le richieste fallite non vengono addebitate, secondo il sito.
- Limite: 20 nuove richieste ogni 10 secondi per account. Il client ne manda una ogni 0,6 secondi.
- Tutte le risposte dell'API sono HTTP 200: l'esito vero è nel campo `code`, che il client controlla.
- Le immagini di riferimento devono essere URL pubblici: il client usa i file del kit su `raw.githubusercontent.com`
  (il ramo `main`, quindi l'arte da usare come riferimento va prima committata).

## Sicurezza e privacy

- **Il repo è pubblico.** La chiave Kie va solo nei secret di GitHub, mai nel codice o nei file.
- I workflow di render già pubblicano i risultati su rami pubblici. Questo workflow **non** lo fa se non lo chiedi
  (`publish = true`): gli artifact restano scaricabili da Actions per 7 giorni.
- Le copertine di video non ancora usciti, se committate o pubblicate, sono visibili a tutti. Per lavori riservati
  valuta un repo privato.

## Test

```bash
python tools/test_thumb_art.py      # client Kie: creazione, attesa, errori, download, taglio dello sfondo
python tools/thumb.py --ep ep01_citofono
```

Il workflow esegue il primo test a ogni lancio.

## Problemi comuni

| Messaggio | Causa e rimedio |
| --- | --- |
| `font non trovati` | Manca `npm ci` oppure passa `--fonts <cartella @fontsource>` |
| `manca thumbs/kit/<nome>.png` | Lancia `python tools/thumb_kit.py` |
| `manca il secret KIE_AI_API` | Crea il secret in Settings → Secrets and variables → Actions |
| `code=401` da Kie | Chiave errata o scaduta (https://kie.ai/api-key) |
| `code=429` da Kie | Troppe richieste: riduci `n` e riprova |
| Candidati con bordo magenta | Il taglio è automatico e semplice: ripulisci a mano o rigenera |
