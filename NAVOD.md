# Raid Team Planner — návod na zprovoznění

Cíl: rozjet appku na **https://nos-tracker.xyz** s přihlášením přes Discord a Google,
kde se každému uživateli ukládají jeho raidy.

Počítej s **2–4 hodinami**, když to děláš poprvé. Nejvíc času sežere OAuth (kroky 3 a 4),
ne kód. Klidně si to rozděl na dva dny — do konce kroku 2 máš appku běžící lokálně,
zbytek je nasazení.

Celé to běží na free tierech. Placenou máš jen doménu.

---

## Co budeš potřebovat

Účty (všechny zdarma):

- [GitHub](https://github.com) — kód a automatické nasazování
- [Supabase](https://supabase.com) — databáze a přihlašování
- [Cloudflare](https://cloudflare.com) — hosting
- [Discord Developer Portal](https://discord.com/developers/applications)
- [Google Cloud Console](https://console.cloud.google.com)

A [Node.js](https://nodejs.org) verze 18 nebo novější (`node -v` ti řekne, co máš).

---

## Krok 1 — Rozjeď to lokálně

V rozbalené složce projektu:

```bash
npm install
```

Zatím ještě nespouštěj `npm run dev` — chybí klíče k databázi. Ty vyrobíme hned.

---

## Krok 2 — Supabase (databáze + účty)

### 2.1 Založ projekt

1. Na [supabase.com](https://supabase.com) dej **New project**
2. Jméno třeba `nos-tracker`, region vyber **Frankfurt** (nejblíž Česku)
3. Vymysli heslo k databázi a **ulož si ho** — potřebuješ ho jen výjimečně, ale bez něj se k DB nedostaneš
4. Počkej ~2 minuty, než se projekt vytvoří

### 2.2 Vytvoř tabulku

1. V levém menu **SQL Editor** → **New query**
2. Otevři soubor `supabase.sql` z projektu, zkopíruj **celý obsah** a vlož ho tam
3. Zmáčkni **Run**

Mělo by naskočit „Success". Tím vznikla tabulka `raids` a hlavně pravidla, díky kterým
každý vidí jen svoje raidy.

> **Tenhle krok nepřeskakuj ani neupravuj.** Ta pravidla (Row Level Security) jsou jediná
> věc, která brání komukoliv na internetu přečíst si cizí data. Bez nich je databáze veřejná.

### 2.3 Opiš si klíče

1. Vlevo dole **Project Settings** → **API**
2. Zkopíruj **Project URL** a **anon public** klíč

Ve složce projektu vytvoř soubor `.env` (podle vzoru `.env.example`):

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...dlouhý_klíč
```

Anon klíč je veřejný, ten se normálně posílá do prohlížeče — na tom není nic tajného.
**Service role** klíč naopak nikdy nikam nedávej.

Teď to zkus:

```bash
npm run dev
```

Otevři http://localhost:5173 — měla by naskočit přihlašovací obrazovka. Tlačítka
zatím nefungují, providery zapneme v dalším kroku.

---

## Krok 3 — Přihlášení přes Discord

### 3.1 Discord aplikace

1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**
2. Pojmenuj ji (třeba `NOS Tracker`) a potvrď
3. Vlevo **OAuth2**
4. U **Redirects** dej **Add Redirect** a vlož:

```
https://TVŮJ-PROJEKT.supabase.co/auth/v1/callback
```

`TVŮJ-PROJEKT` nahraď tím, co máš v `VITE_SUPABASE_URL`. **Save Changes** dole.

5. Zkopíruj si **Client ID** a **Client Secret** (u secretu musíš kliknout na *Reset Secret*, když ho nevidíš)

### 3.2 Zapni ho v Supabase

1. Supabase → **Authentication** → **Providers** → **Discord**
2. Přepni na **Enabled**, vlož Client ID a Client Secret
3. **Save**

---

## Krok 4 — Přihlášení přes Google

1. [Google Cloud Console](https://console.cloud.google.com) → nahoře vytvoř nový projekt
2. **APIs & Services** → **OAuth consent screen**
   - typ **External**, vyplň jméno appky, svůj email
   - u **Test users** přidej svůj Google email (než appku publikuješ, přihlásí se jen ti, co jsou tady)
3. **Credentials** → **Create Credentials** → **OAuth client ID**
   - typ **Web application**
   - **Authorized redirect URIs** → přidej stejnou adresu jako u Discordu:

```
https://TVŮJ-PROJEKT.supabase.co/auth/v1/callback
```

4. Zkopíruj **Client ID** a **Client Secret**
5. Supabase → **Authentication** → **Providers** → **Google** → Enabled + vlož oboje → **Save**

---

## Krok 5 — Nastav adresy v Supabase

Supabase → **Authentication** → **URL Configuration**:

- **Site URL:** `https://nos-tracker.xyz`
- **Redirect URLs:** přidej obě tyhle řádky:

```
https://nos-tracker.xyz/**
http://localhost:5173/**
```

Ta druhá je proto, abys mohl testovat i lokálně. Bez toho tě po přihlášení vyhodí.

Teď si na `localhost:5173` zkus přihlášení — mělo by projít a naskočit seznam raidů.
Založ jeden zkušební a ověř, že po refreshi zůstal.

---

## Krok 6 — Nahraj kód na GitHub

```bash
git init
git add .
git commit -m "Raid Team Planner"
```

Na GitHubu vytvoř **nový prázdný repozitář** (klidně private) a pak:

```bash
git remote add origin https://github.com/TVOJE-JMENO/nos-tracker.git
git branch -M main
git push -u origin main
```

Soubor `.env` se nenahraje — je v `.gitignore` a je to tak správně.

---

## Krok 7 — Nasazení na Cloudflare Pages

1. [Cloudflare dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Propoj GitHub a vyber repozitář
3. Nastavení buildu:
   - **Framework preset:** Vite (nebo None)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Rozbal **Environment variables** a přidej obě proměnné z `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   > Na tohle se zapomíná nejčastěji. Když je nevyplníš, nasadí se to, ale uvidíš bílou
   > stránku — appka nemá kam se připojit.
5. **Save and Deploy**

Za chvíli dostaneš adresu typu `nos-tracker.pages.dev`. Otevři ji a zkus přihlášení.

Od téhle chvíle platí: kdykoliv pushneš na GitHub, Cloudflare to samo nasadí.

---

## Krok 8 — Připoj doménu nos-tracker.xyz

Doména je na Namecheapu, hosting na Cloudflare. Nejjednodušší je předat DNS Cloudflaru.

### 8.1 Přidej doménu do Cloudflare

1. Cloudflare dashboard → **Add a site** → napiš `nos-tracker.xyz`
2. Vyber **Free** plán
3. Cloudflare načte existující DNS záznamy a ukáže ti **dva nameservery**, něco jako:

```
dana.ns.cloudflare.com
rob.ns.cloudflare.com
```

Ty si opiš.

### 8.2 Přepni nameservery na Namecheapu

1. Namecheap → **Domain List** → u `nos-tracker.xyz` dej **Manage**
2. Zůstaň na záložce **Domain** (ne Advanced DNS)
3. Sekce **Nameservers** → přepni z *Namecheap BasicDNS* na **Custom DNS**
4. Vlož ty dva nameservery z Cloudflare a ulož (zelená fajfka)

Propsání trvá většinou pár minut, občas i pár hodin. Cloudflare ti pošle mail, až to naběhne.

### 8.3 Nasměruj doménu na appku

1. Cloudflare → **Workers & Pages** → tvůj projekt → záložka **Custom domains**
2. **Set up a custom domain** → `nos-tracker.xyz` → potvrď
3. Zopakuj pro `www.nos-tracker.xyz`, ať funguje obojí

DNS záznamy i HTTPS certifikát si Cloudflare udělá sám.

---

## Krok 9 — Ochrana proti uspání databáze

Supabase uspí projekt, když se do databáze **7 dní** nikdo netrefí. Data zůstanou, ale
appka je do ručního probuzení nedostupná. Když guilda plánuje raidy průběžně, nestane se to —
ale prázdniny to spolehlivě spustí.

Nejjednodušší pojistka je [UptimeRobot](https://uptimerobot.com) (free):

1. Zaregistruj se → **Add New Monitor**
2. **Monitor Type:** HTTP(s)
3. **URL:** `https://nos-tracker.xyz`
4. **Monitoring Interval:** 5 minut
5. Ulož

Tím se web pinguje pořád dokola a zároveň ti přijde mail, kdyby spadl.

> Pozor: ping na web sám o sobě nemusí sáhnout do databáze. Jistější je, když se na stránku
> jednou za čas někdo přihlásí. Když víš, že bude delší pauza, nejspolehlivější je prostě
> jednou za pár dní otevřít web a přihlásit se.

---

## Hotovo

- `https://nos-tracker.xyz` — appka
- Přihlášení přes Discord i Google
- Každý má svoje raidy, cizí nevidí
- Max 10 raidů, starší 7 dní se samy mažou
- `git push` = nová verze na webu

---

## Když něco nefunguje

**Bílá stránka po nasazení**
Nejsou vyplněné environment variables na Cloudflare. Zkontroluj přesné názvy včetně
prefixu `VITE_`. Po přidání musíš dát **Retry deployment** — samo se to nepřenasadí.

**„Invalid login credentials" / redirect zpátky na login**
V Supabase → Authentication → URL Configuration chybí správná adresa v Redirect URLs.
Musí tam být i ty hvězdičky `/**`.

**Discord přihlášení hlásí „Invalid OAuth2 redirect_uri"**
Redirect v Discord portálu musí sedět **přesně** na
`https://TVŮJ-PROJEKT.supabase.co/auth/v1/callback` — žádné lomítko navíc na konci.

**Google hlásí „access_blocked" nebo „app not verified"**
Nemáš se přidaného jako Test user v OAuth consent screen. Dokud appku nepublikuješ,
přihlásí se jen lidi z toho seznamu. Až to budeš chtít pustit celé guildě, dej
**Publish app** (u základních údajů jako email a jméno nechce Google žádné ověřování).

**Raidy se neukládají, v konzoli je chyba o RLS**
Neproběhl krok 2.2, nebo neproběhl celý. Pusť `supabase.sql` znovu — je psaný tak,
že se dá spustit opakovaně.

**Appka je „paused" na Supabase**
Uspalo se to po týdnu nečinnosti. Supabase dashboard → tvůj projekt → **Restore project**.
Trvá to ~30 sekund a data jsou v pořádku.

---

## Co dál (nápady)

- **Sdílení odkazem** místo screenshotu — přidat do tabulky `share_token` a veřejnou
  read-only stránku. Počítej s tím, že to bude první, co po tobě guilda bude chtít.
- **Ikony do souborů** — teď sedí jako base64 přímo v kódu (asi 150 kB). Vytáhnout je do
  `public/icons/` a build bude svižnější, prohlížeč si je nacachuje.
- **Sdílené raidy pro guildu** — sloupec `guild_id` a upravená RLS pravidla, aby raid
  viděli všichni z guildy, ale editoval jen zakladatel.
