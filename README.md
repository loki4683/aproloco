# APROLOCO

App (PWA) per il direttivo della Pro Loco: eventi con wizard e checklist, calendario del salone, ricettario e preventivatore menu, spesa, documenti, bilancio, magazzino, certificazioni e manuali.

Tutto il direttivo può consultarla; solo presidente, responsabile contabile e responsabile cucine possono modificarla (ognuno con il proprio PIN).

## 1. Pubblicare l'app su GitHub Pages

1. Crea un nuovo repository **pubblico** su GitHub, ad esempio `aproloco`.
2. Carica **tutto il contenuto** di questa cartella: `index.html`, `manifest.webmanifest`, `sw.js` e le cartelle `css`, `js`, `lib`, `icons`. La cartella `worker` serve solo per il passo 2, ma se la carichi non dà problemi.
3. Vai su **Settings → Pages** e imposta *Source: Deploy from a branch*, *Branch: main / (root)*, poi premi **Save**.
4. Dopo un minuto l'app è online su `https://TUONOME.github.io/aproloco/`.

## 2. Creare il server di condivisione (Cloudflare Worker)

È lo stesso procedimento usato per Dispensa.

1. In Cloudflare apri **Storage & Databases → KV** e crea un namespace chiamato `PROLOCO`.
2. In **Workers & Pages → Create → Worker** crea un Worker chiamato `proloco`. Premi **Edit code**, incolla il contenuto di `worker/worker.js` e premi **Deploy**.
3. Nel Worker apri **Settings → Bindings → Add → KV namespace**. Il nome della variabile deve essere `PROLOCO` e il namespace quello creato al punto 1.
4. Sempre in **Settings → Variables and Secrets** aggiungi quattro variabili di tipo **Secret**:
   - `PIN_DIRETTIVO`: PIN per la sola consultazione, da dare a tutto il direttivo
   - `PIN_PRESIDENTE`
   - `PIN_CONTABILE`
   - `PIN_CUCINE`

   I quattro PIN devono essere diversi tra loro.
5. L'indirizzo del Worker sarà `https://proloco.loki4683.workers.dev`, che è già precompilato nell'app. Se è diverso, scrivilo nella schermata di accesso.

## 3. Primo utilizzo

1. Apri l'app e inserisci il tuo PIN.
2. Nel tasto **DOCUMENTI**:
   - premi **Crea** su *NOTE PROLOCO* e compila i dati della Pro Loco;
   - carica i moduli usando esattamente questi nomi: `TIPOLOGIA B`, `ANAGRAFICA`, `NOTIFICA`, `SEGNALAZIONE`, `1174`, `SUOLO PUBBLICO`, `DEROGA SONORA`.
3. Con il tasto **Campi** vedi i campi compilabili di ogni PDF. In NOTE PROLOCO scrivi una riga `NOME CAMPO: valore` per ognuno: maiuscole, spazi e trattini non contano.

## Installare l'app

- **PC (Chrome o Edge):** clicca sull'icona "Installa" nella barra dell'indirizzo.
- **Android:** apri il menu ⋮ e scegli **Installa app**.

## Come vengono compilati i documenti

- **PDF con campi compilabili:** i campi vengono riempiti con i dati di NOTE PROLOCO e dell'evento. I campi senza dato restano in bianco e il PDF resta modificabile.
- **File di testo (.txt):** puoi usare segnaposto come `{{NOME EVENTO}}`, `{{PRESIDENTE}}`, `{{DATA EVENTO}}`. Vengono sostituiti e il risultato viene trasformato in PDF.
- **PDF "piatti" (scansioni, senza campi):** vengono allegati così come sono e vanno completati a mano.

I dati dell'evento inseriti in automatico sono:

| Dato | Contenuto |
|---|---|
| NOME EVENTO | nome dell'evento |
| DATA EVENTO | date dell'evento |
| DATA INIZIO | primo giorno |
| DATA FINE | ultimo giorno |
| ORA INIZIO | ora di inizio |
| ORA FINE | ora di fine |
| ORARIO | ora di inizio e di fine |
| DATA PREPARAZIONE | primo giorno di preparazione |
| DATA OGGI | data di compilazione |
| ANNO | anno dell'evento |

## Limiti

- Lo spazio gratuito di Cloudflare KV basta per centinaia di documenti. Ogni file può pesare al massimo 24 MB.
- Se due persone modificano la stessa sezione nello stesso istante, resta salvata l'ultima modifica.
- I prezzi del preventivatore si inseriscono nel listino, a mano o importando un CSV. Per ogni prezzo si indicano fonte e data, e quelli con più di 30 giorni vengono segnalati in arancione.
