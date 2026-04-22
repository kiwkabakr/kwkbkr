import io
import logging
import traceback

import httpx
import qrcode
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ConversationHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from api_client import BackendAPI

log = logging.getLogger("bot")

# Conversation states
(
    DEPOSIT_CURRENCY,
    PAYOUT_CURRENCY,
    PAYOUT_WALLET,
    PAYOUT_AMOUNT,
    PAYOUT_CODE,
    BET_OPTION,
    BET_AMOUNT,
    DELETE_CONFIRM,
    USERNAME_CODE,
) = range(9)

SITE_URL = "https://czutka.gg"

api: BackendAPI  # set by build_app()


def _fmt_pln(val) -> str:
    """PLN for saldo / balances: up to 8 decimals so small amounts are not rounded to 0,00 zł."""
    try:
        x = float(val)
    except (TypeError, ValueError):
        return "0,00 zł"
    if x == 0:
        return "0,00 zł"
    s = f"{x:.8f}".rstrip("0").rstrip(".")
    if "." not in s:
        s = f"{x:.2f}"
    elif len(s.split(".", 1)[1]) < 2:
        s = f"{x:.2f}"
    # Polish style: decimal comma
    return s.replace(".", ",") + " zł"


# backward compat alias used in a few places
_fmt_usd = _fmt_pln


_CRYPTO_DECIMALS = {"BTC": 8, "ETH": 8, "USDC": 6, "SOL": 9}


def _fmt_crypto_native(amount, currency: str) -> str:
    """On-chain amount in currency units (not USD)."""
    try:
        x = float(amount)
    except (TypeError, ValueError):
        return "0"
    cur = str(currency or "").upper()
    d = _CRYPTO_DECIMALS.get(cur, 8)
    s = f"{x:.{d}f}".rstrip("0").rstrip(".")
    return s if s else "0"


# ── Helpers ────────────────────────────────────────────────────────────

async def _send_qr(context: ContextTypes.DEFAULT_TYPE, chat_id: int, currency: str, address: str):
    qr = qrcode.QRCode(box_size=10, border=4)
    qr.add_data(address)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    caption = (
        f"\U0001f4e5 *Adres wp\u0142aty {currency}*\n\n"
        f"`{address}`\n\n"
        "\U0001f4cb Zeskanuj kod QR lub *dotknij adresu*, by go skopiowa\u0107.\n\n"
        "\u23f1 Po potwierdzeniu na blockchainie saldo zaktualizuje si\u0119 automatycznie \u2014 "
        "bez minimalnej i maksymalnej kwoty."
    )
    await context.bot.send_photo(chat_id=chat_id, photo=buf, caption=caption, parse_mode="Markdown")


def _currency_kb():
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("BTC", callback_data="cur:BTC"),
            InlineKeyboardButton("ETH", callback_data="cur:ETH"),
        ],
        [
            InlineKeyboardButton("USDC", callback_data="cur:USDC"),
            InlineKeyboardButton("SOL", callback_data="cur:SOL"),
        ],
    ])


# ── /start ─────────────────────────────────────────────────────────────

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    log.info("/start from %s (id=%s)", update.effective_user.username, update.effective_user.id)
    name = update.effective_user.first_name or "tam"
    user = update.effective_user
    tid = str(user.id)
    try:
        reg = await api.register_user(tid, user.username, user.first_name)
        log.info("register_user ok id=%s isNew=%s", user.id, reg.get("isNew"))
    except httpx.HTTPStatusError as e:
        log.warning("register_user HTTP %s: %s", e.response.status_code, e.response.text)
        detail = ""
        try:
            detail = e.response.json().get("error", "")
        except Exception:
            pass
        msg = (
            "\u26a0\ufe0f *Nie uda\u0142o si\u0119 po\u0142\u0105czy\u0107 z serwerem lub zarejestrowa\u0107 konta.*\n\n"
            "Sprawd\u017a, czy backend dzia\u0142a i czy klucz bota (X-Bot-Key) jest poprawny."
        )
        if detail:
            msg += f"\n\n`{detail}`"
        await update.message.reply_text(msg, parse_mode="Markdown")
        return ConversationHandler.END
    except Exception as e:
        log.warning("register_user failed: %s", e)
        await update.message.reply_text(
            "\u274c *B\u0142\u0105d rejestracji.* Spr\u00f3buj ponownie za chwil\u0119 lub napisz do supportu.\n\n"
            f"Szczeg\u00f3\u0142y: `{e!s}`",
            parse_mode="Markdown",
        )
        return ConversationHandler.END

    if reg.get("isNew"):
        pk = reg.get("passkey") or "—"
        vc = reg.get("verificationCode") or "—"
        uname = user.username
        uname_line = f"Username Telegram: `@{uname}`\n" if uname else "Username Telegram: _nie ustawiony_\n"
        intro = (
            f"\U0001f44b *Cze\u015b\u0107, {name}!*\n\n"
            "\u2705 *Konto zosta\u0142o utworzone* i powi\u0105zane z Twoim Telegramem.\n\n"
            f"{uname_line}"
            f"\U0001f194 ID Telegram: `{tid}`\n\n"
            "\U0001f511 *Zapisz te dane \u2014 pokazujemy je tylko teraz:*\n\n"
            f"Passkey:\n`{pk}`\n\n"
            f"Kod weryfikacji (np. do /payout):\n`{vc}`\n\n"
            "_\U0001f4f4 Usu\u0144 t\u0119 wiadomo\u015b\u0107 po zapisaniu._\n"
        )
        await update.message.reply_text(intro, parse_mode="Markdown")
    else:
        u = reg.get("user") or {}
        stored_un = (u.get("username") or "").strip()
        if stored_un:
            who = f"@{stored_un}"
        elif user.username:
            who = f"@{user.username} (na Telegramie; zapisane w profilu: brak)"
        else:
            who = "_brak @username — identyfikacja po ID Telegram_"
        intro = (
            f"\U0001f44b *Cze\u015b\u0107, {name}!*\n\n"
            "\U0001f3af *Masz ju\u017c konto* na czutka.gg powi\u0105zane z tym Telegramem.\n\n"
            f"\U0001f464 Profil: {who}\n"
            f"\U0001f194 ID Telegram: `{tid}`\n"
        )
        await update.message.reply_text(intro, parse_mode="Markdown")

    text = (
        "\U0001f4a1 *Jak korzysta\u0107 z czutka.gg*\n\n"
        "Rynek predykcji bez op\u0142at, transparentny i bezpieczny \u2014 kryptowaluty.\n\n"
        "*Jak to dzia\u0142a?*\n"
        "1\u20e3 Wp\u0142a\u0107 krypto (/deposit)\n"
        "2\u20e3 Znajd\u017a bet na stronie czutka.gg\n"
        "3\u20e3 Skopiuj ID betu i u\u017cyj /bet <ID>\n"
        "4\u20e3 Wygraj i wyp\u0142a\u0107 (/payout)\n\n"
        "\U0001f5c2\ufe0f *Komendy:*\n"
        "/me — status passkey / kodu (pokazane tylko przy pierwszym utworzeniu konta)\n"
        "/saldo — saldo\n"
        "/deposit — wpłata (BTC, ETH, USDC, SOL)\n"
        "/payout — wypłata\n"
        "/bet `<ID>` — postaw zakład\n"
        "/code `<KOD>` — darmowe 10 zł\n"
        "/mybets — Twoje bety\n"
        "/history — historia wpłat, wypłat, betów\n"
        "/stats — statystyki\n"
        "/info — szczegóły konta\n"
        "/delete — usuń konto\n"
    )

    kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("\U0001f310 Witaj na czutka.gg", url=SITE_URL)],
    ])
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=kb)

    if reg.get("usernameMismatch"):
        ctx.user_data["pending_username"] = reg.get("currentTelegramUsername") or (user.username or "")
        await update.message.reply_text(
            "\U0001f504 *Wykryto zmian\u0119 username*\n\n"
            f"Nowy Telegram username: `@{ctx.user_data['pending_username']}`\n\n"
            "\U0001f510 Aby zaktualizowa\u0107 konto, wy\u015blij *6-cyfrowy kod weryfikacji*.\n"
            "Je\u015bli nie masz kodu, skontaktuj si\u0119 z supportem.\n"
            "\u21a9\ufe0f Wy\u015blij /cancel aby pomin\u0105\u0107.",
            parse_mode="Markdown",
        )
        return USERNAME_CODE
    return ConversationHandler.END


async def username_code(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    code = update.message.text.strip()
    if not code.isdigit() or len(code) != 6:
        await update.message.reply_text("\u26a0\ufe0f Nieprawid\u0142owy kod. Musi mie\u0107 dok\u0142adnie 6 cyfr.")
        return USERNAME_CODE

    tid = str(update.effective_user.id)
    new_username = ctx.user_data.get("pending_username") or (update.effective_user.username or "")
    try:
        await api.sync_username(tid, new_username, code)
    except Exception as e:
        err = str(e)
        if "Invalid verification" in err:
            await update.message.reply_text("\u26a0\ufe0f Nieprawid\u0142owy kod weryfikacji.")
        else:
            await update.message.reply_text(f"\u274c B\u0142\u0105d: {err}")
        return ConversationHandler.END

    await update.message.reply_text(
        f"\u2705 Username zaktualizowany: `@{new_username}`",
        parse_mode="Markdown",
    )
    return ConversationHandler.END


async def cmd_cancel(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("\u21a9\ufe0f Anulowano.")
    return ConversationHandler.END


# ── /me ────────────────────────────────────────────────────────────────

async def cmd_me(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    log.info("/me from %s", update.effective_user.id)
    tid = str(update.effective_user.id)
    try:
        data = await api.get_passkey(tid)
    except Exception:
        await update.message.reply_text(
            "\U0001f464 Nie masz konta. Użyj /start aby się zarejestrować."
        )
        return

    if data.get("alreadyShown"):
        await update.message.reply_text(
            "\U0001f512 Passkey i kod weryfikacji zostały już pokazane (przy pierwszym /start lub pierwszym /me).\n"
            "Ze względów bezpieczeństwa nie wyświetlamy ich ponownie.\n\n"
            "Jeśli je zgubiłeś, skontaktuj się z supportem czutka.gg.",
            parse_mode="Markdown",
        )
        return

    passkey = data["passkey"]
    code = data["verificationCode"]
    await update.message.reply_text(
        "\U0001f6a8 *WAŻNE — zapisz i usuń tę wiadomość!*\n\n"
        f"\U0001f511 Twój passkey:\n`{passkey}`\n\n"
        f"\U0001f510 Kod weryfikacji (do /payout):\n`{code}`\n\n"
        "\U0001f4a1 Ten kod wyświetli się tylko *raz*. Następnym razem /me nie pokaże go ponownie.",
        parse_mode="Markdown",
    )


# ── /deposit ───────────────────────────────────────────────────────────

async def cmd_deposit(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    log.info("/deposit from %s", update.effective_user.id)
    await update.message.reply_text(
        "\U0001f4e5 *Wpłata kryptowalut*\n\n"
        "Bez opłat. Bez minimalnej ani maksymalnej kwoty.\n"
        "Po potwierdzeniu na blockchainie saldo zostanie automatycznie zaktualizowane.\n\n"
        "\U0001f4b0 Wybierz walutę:",
        parse_mode="Markdown",
        reply_markup=_currency_kb(),
    )
    return DEPOSIT_CURRENCY


async def deposit_currency(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    currency = query.data.split(":")[1]
    tid = str(query.from_user.id)

    try:
        result = await api.create_deposit(tid, currency)
    except Exception as e:
        await query.edit_message_text(f"\u274c Błąd: {e}")
        return ConversationHandler.END

    address = result["address"]
    await query.message.delete()

    steps = (
        f"\U0001f4e5 *Wpłata {currency} — krok po kroku:*\n\n"
        f"1\u20e3 Otwórz swój portfel krypto\n"
        f"2\u20e3 Wybierz *{currency}* jako walutę\n"
        f"3\u20e3 Wklej adres poniżej lub zeskanuj QR\n"
        f"4\u20e3 Wyślij dowolną kwotę\n"
        f"5\u20e3 Poczekaj na potwierdzenie na blockchainie\n\n"
        f"\u2705 Saldo zostanie zaktualizowane automatycznie!"
    )
    await ctx.bot.send_message(chat_id=query.message.chat_id, text=steps, parse_mode="Markdown")
    await _send_qr(ctx, query.message.chat_id, currency, address)
    return ConversationHandler.END


# ── /payout ────────────────────────────────────────────────────────────

async def cmd_payout(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    log.info("/payout from %s", update.effective_user.id)
    tid = str(update.effective_user.id)
    try:
        user = await api.get_user(tid)
    except Exception:
        await update.message.reply_text("\U0001f464 Nie masz konta. Użyj /start.")
        return ConversationHandler.END

    await update.message.reply_text(
        f"\U0001f4b8 *Wypłata*\n\n"
        f"\U0001f4b0 Twoje saldo: *{_fmt_pln(user['balance'])}*\n"
        f"Bez opłat. Realizacja do 24h.\n\n"
        f"\U0001f4b5 Wybierz walutę wypłaty:",
        parse_mode="Markdown",
        reply_markup=_currency_kb(),
    )
    return PAYOUT_CURRENCY


async def payout_currency(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    ctx.user_data["payout_currency"] = query.data.split(":")[1]
    await query.edit_message_text(
        f"\U0001f4b5 Waluta: *{ctx.user_data['payout_currency']}*\n\n"
        "\U0001f4cb Podaj adres portfela, na który chcesz otrzymać wypłatę:",
        parse_mode="Markdown",
    )
    return PAYOUT_WALLET


async def payout_wallet(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    ctx.user_data["payout_wallet"] = update.message.text.strip()
    await update.message.reply_text(
        "\U0001f4b0 Podaj kwotę do wypłaty (w PLN):",
        parse_mode="Markdown",
    )
    return PAYOUT_AMOUNT


async def payout_amount(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    try:
        amount = float(update.message.text.strip().replace(",", ".").replace("zł", "").replace("PLN", "").strip())
        if amount <= 0:
            raise ValueError
    except ValueError:
        await update.message.reply_text(
            "\u26a0\ufe0f Nieprawidłowa kwota. Podaj liczbę, np. `50`.", parse_mode="Markdown"
        )
        return PAYOUT_AMOUNT

    ctx.user_data["payout_amount"] = amount
    await update.message.reply_text(
        "\U0001f510 Podaj 6-cyfrowy kod weryfikacji (z komendy /me):",
        parse_mode="Markdown",
    )
    return PAYOUT_CODE


async def payout_code(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    code = update.message.text.strip()
    if not code.isdigit() or len(code) != 6:
        await update.message.reply_text(
            "\u26a0\ufe0f Nieprawidłowy kod. Musi mieć dokładnie 6 cyfr."
        )
        return PAYOUT_CODE

    tid = str(update.effective_user.id)
    currency = ctx.user_data["payout_currency"]
    wallet = ctx.user_data["payout_wallet"]
    amount = ctx.user_data["payout_amount"]

    try:
        await api.request_payout(tid, currency, wallet, amount, code)
    except Exception as e:
        err = str(e)
        if "Invalid verification" in err:
            await update.message.reply_text(
                "\u26a0\ufe0f Nieprawidłowy kod weryfikacji."
            )
        elif "Insufficient" in err:
            await update.message.reply_text("\u26a0\ufe0f Niewystarczające saldo.")
        else:
            await update.message.reply_text(f"\u274c Błąd: {err}")
        return ConversationHandler.END

    await update.message.reply_text(
        f"\u2705 *Wypłata złożona — potwierdzenie*\n\n"
        f"\U0001f4b0 Kwota: *{_fmt_pln(amount)}* ({currency})\n"
        f"\U0001f4cb Na portfel: `{wallet}`\n\n"
        f"\u23f1 Realizacja do 24 godzin. Bez opłat.",
        parse_mode="Markdown",
    )
    return ConversationHandler.END


# ── /bet <id> ──────────────────────────────────────────────────────────

async def cmd_bet(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    log.info("/bet from %s: %s", update.effective_user.id, update.message.text)
    parts = update.message.text.strip().split()
    if len(parts) < 2:
        await update.message.reply_text(
            "\U0001f3af *Jak używać /bet:*\n\n"
            "1\u20e3 Wejdź na czutka.gg\n"
            "2\u20e3 Wybierz bet i skopiuj jego ID\n"
            "3\u20e3 Wróć tu i wpisz: `/bet <ID>`\n\n"
            "\U0001f4a1 Przykład: `/bet A1B2C3`",
            parse_mode="Markdown",
        )
        return ConversationHandler.END

    short_id = parts[1].upper()
    try:
        bet = await api.get_bet(short_id)
    except Exception:
        await update.message.reply_text(
            f"\u274c Bet `{short_id}` nie znaleziony lub zamknięty.", parse_mode="Markdown"
        )
        return ConversationHandler.END

    ctx.user_data["bet_data"] = bet
    options_text = "\n".join(
        f"  {i + 1}. *{o['label']}* — {o['multiplier']}x"
        for i, o in enumerate(bet["options"])
    )

    tid = str(update.effective_user.id)
    try:
        user = await api.get_user(tid)
        balance = user["balance"]
    except Exception:
        balance = 0

    await update.message.reply_text(
        f"\U0001f3af *{bet['title']}*\n\n"
        f"\U0001f4cb Opcje:\n{options_text}\n\n"
        f"\U0001f4b0 Twoje saldo: *{_fmt_pln(balance)}*\n\n"
        f"\u27a1\ufe0f Wyślij numer opcji (np. `1`):",
        parse_mode="Markdown",
    )
    return BET_OPTION


async def bet_option(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    bet = ctx.user_data.get("bet_data")
    if not bet:
        await update.message.reply_text(
            "\u23f0 Sesja wygasła. Użyj /bet <ID> ponownie."
        )
        return ConversationHandler.END

    try:
        idx = int(update.message.text.strip()) - 1
        option = bet["options"][idx]
    except (ValueError, IndexError):
        await update.message.reply_text(
            f"\u26a0\ufe0f Podaj numer od 1 do {len(bet['options'])}."
        )
        return BET_OPTION

    ctx.user_data["bet_option"] = option

    tid = str(update.effective_user.id)
    try:
        user = await api.get_user(tid)
        balance = user["balance"]
    except Exception:
        balance = 0

    if balance <= 0:
        await update.message.reply_text(
            "\u26a0\ufe0f Nie masz środków na koncie. Użyj /deposit aby wpłacić krypto.",
        )
        return ConversationHandler.END

    await update.message.reply_text(
        f"\u2705 Wybrałeś: *{option['label']}* ({option['multiplier']}x)\n\n"
        f"\U0001f4b0 Dostępne saldo: *{_fmt_pln(balance)}*\n"
        f"\U0001f4b5 Podaj kwotę zakładu (w PLN):",
        parse_mode="Markdown",
    )
    return BET_AMOUNT


async def bet_amount(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    try:
        amount = float(update.message.text.strip().replace(",", ".").replace("zł", "").replace("PLN", "").strip())
        if amount <= 0:
            raise ValueError
    except ValueError:
        await update.message.reply_text("\u26a0\ufe0f Nieprawidłowa kwota.")
        return BET_AMOUNT

    bet = ctx.user_data["bet_data"]
    option = ctx.user_data["bet_option"]
    tid = str(update.effective_user.id)

    try:
        result = await api.place_bet(tid, bet["shortId"], option["id"], amount)
    except Exception as e:
        err = str(e)
        if "Insufficient" in err:
            await update.message.reply_text(
                "\u26a0\ufe0f Niewystarczające saldo. Użyj /deposit."
            )
        else:
            await update.message.reply_text(f"\u274c Błąd: {err}")
        return ConversationHandler.END

    ub = result["userBet"]
    await update.message.reply_text(
        f"\u2705 *Bet postawiony!*\n\n"
        f"\U0001f3af Bet: {bet['title']}\n"
        f"\U0001f4ca Opcja: *{option['label']}*\n"
        f"\U0001f4b0 Kwota: *{_fmt_pln(amount)}*\n"
        f"\U0001f4c8 Potencjalna wygrana: *{_fmt_pln(ub['potentialWin'])}*\n"
        f"\U0001f4b5 Nowe saldo: *{_fmt_pln(result['newBalance'])}*",
        parse_mode="Markdown",
    )
    return ConversationHandler.END


# ── /mybets ────────────────────────────────────────────────────────────

async def cmd_mybets(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    log.info("/mybets from %s", update.effective_user.id)
    tid = str(update.effective_user.id)
    try:
        bets = await api.get_user_bets(tid)
    except Exception:
        await update.message.reply_text("\U0001f464 Nie masz konta. Użyj /start.")
        return

    if not bets:
        await update.message.reply_text(
            "\U0001f4ed Nie masz żadnych betów. Użyj /bet <ID> aby postawić."
        )
        return

    active = [b for b in bets if b["status"] == "active"]
    finished = [b for b in bets if b["status"] != "active"]

    lines = ["\U0001f3af *Twoje bety:*\n"]

    if active:
        lines.append("\U0001f4cc *Aktywne:*")
        for b in active:
            lines.append(
                f"  • {b['betTitle']} — *{b['optionLabel']}*\n"
                f"    Kwota: {_fmt_pln(b['amount'])} | Pot. wygrana: {_fmt_pln(b['potentialWin'])}"
            )

    if finished:
        lines.append("\n\U0001f3c1 *Zakończone:*")
        for b in finished:
            icon = "✅" if b["status"] == "won" else "❌"
            lines.append(
                f"  {icon} {b['betTitle']} — *{b['optionLabel']}* ({b['status']})\n"
                f"    Kwota: {_fmt_pln(b['amount'])} | Pot. wygrana: {_fmt_pln(b['potentialWin'])}"
            )

    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


# ── /info ──────────────────────────────────────────────────────────────

async def cmd_info(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    log.info("/info from %s", update.effective_user.id)
    tid = str(update.effective_user.id)
    try:
        info = await api.get_user_info(tid)
    except Exception:
        await update.message.reply_text("\U0001f464 Nie masz konta. Użyj /start.")
        return

    since = info.get("memberSince", "—")
    if isinstance(since, str) and "T" in since:
        since = since.split("T")[0]

    await update.message.reply_text(
        f"\U0001f4c4 *Informacje o koncie*\n\n"
        f"\U0001f464 U\u017cytkownik: *{info.get('firstName', '\u2014')}* ({info.get('username', '\u2014')})\n"
        f"\U0001f194 Telegram ID: `{info['telegramId']}`\n"
        f"\U0001f4b0 Saldo: *{_fmt_pln(info['balance'])}*\n\n"
        f"\U0001f3af Bety postawione: *{info['totalBets']}*\n"
        f"\u2705 Bety wygrane: *{info['wonBets']}*\n"
        f"\U0001f4e5 \u0141\u0105czne wp\u0142aty: *{_fmt_pln(info['totalDeposited'])}*\n"
        f"\U0001f4e4 \u0141\u0105czne wyp\u0142aty: *{_fmt_pln(info['totalWithdrawn'])}*\n\n"
        f"\U0001f4c5 Konto od: {since}",
        parse_mode="Markdown",
    )


# ── /delete ────────────────────────────────────────────────────────────

async def cmd_delete(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    log.info("/delete from %s", update.effective_user.id)
    kb = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("Tak, usuń", callback_data="delete:yes"),
            InlineKeyboardButton("Nie, anuluj", callback_data="delete:no"),
        ]
    ])
    await update.message.reply_text(
        "\u26a0\ufe0f *Czy na pewno chcesz usunąć konto?*\n\n"
        "Wszystkie dane (saldo, bety, historia) zostaną trwale usunięte.\n"
        "Tej operacji nie można cofnąć.",
        parse_mode="Markdown",
        reply_markup=kb,
    )
    return DELETE_CONFIRM


async def delete_confirm(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    if query.data == "delete:no":
        await query.edit_message_text(
            "\u21a9\ufe0f Anulowano. Twoje konto jest bezpieczne."
        )
        return ConversationHandler.END

    tid = str(query.from_user.id)
    try:
        await api.delete_user(tid)
        await query.edit_message_text(
            "\u2705 Konto usuni\u0119te. \u017badne dane nie zosta\u0142y zachowane.\n\n"
            "U\u017cyj /start je\u015bli chcesz wr\u00f3ci\u0107."
        )
    except Exception as e:
        await query.edit_message_text(f"\u274c B\u0142\u0105d: {e}")
    return ConversationHandler.END


# ── /saldo ─────────────────────────────────────────────────────────────

async def cmd_saldo(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    log.info("/saldo from %s", update.effective_user.id)
    tid = str(update.effective_user.id)
    try:
        user = await api.get_user(tid)
    except Exception:
        await update.message.reply_text("\U0001f464 Nie masz konta. Użyj /start.")
        return

    await update.message.reply_text(
        f"\U0001f4b0 *Twoje saldo:* {_fmt_pln(user['balance'])}",
        parse_mode="Markdown",
    )


# ── /code <KOD> ────────────────────────────────────────────────────────

async def cmd_code(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    log.info("/code from %s: %s", update.effective_user.id, update.message.text)
    parts = update.message.text.strip().split()
    if len(parts) < 2:
        await update.message.reply_text(
            "\U0001f381 *Jak używać /code:*\n\n"
            "Wpisz: `/code <KOD>`\n\n"
            "Kody otrzymasz na stronie *czutka.gg/darmowe-nagrody*.",
            parse_mode="Markdown",
        )
        return

    tid = str(update.effective_user.id)
    code = parts[1].upper()
    try:
        result = await api.redeem_code(tid, code)
    except Exception as e:
        err = str(e)
        if "already redeemed" in err:
            await update.message.reply_text(
                "\u26a0\ufe0f Ten kod zosta\u0142 ju\u017c wykorzystany."
            )
        elif "Invalid code" in err:
            await update.message.reply_text("\u26a0\ufe0f Nieprawid\u0142owy kod.")
        elif "User not found" in err:
            await update.message.reply_text("\U0001f464 Nie masz konta. U\u017cyj /start.")
        elif "No deposit" in err:
            await update.message.reply_text(
                "\U0001f4b3 *Najpierw zr\u00f3b wp\u0142at\u0119*\n\n"
                "Aby odebra\u0107 kod musisz mie\u0107 co najmniej jedn\u0105 potwierdzon\u0105 wp\u0142at\u0119. "
                "U\u017cyj /deposit aby wp\u0142aci\u0107 dowoln\u0105 kwot\u0119.",
                parse_mode="Markdown",
            )
        elif "Insufficient deposit" in err:
            await update.message.reply_text(
                f"\U0001f4b3 *Wi\u0119ksza wp\u0142ata wymagana*\n\n{err.replace('Insufficient deposit — ', '')}",
                parse_mode="Markdown",
            )
        elif "Insufficient wagered" in err:
            await update.message.reply_text(
                f"\U0001f3b2 *Wi\u0119cej obrotu wymagane*\n\n{err.replace('Insufficient wagered — ', '')}",
                parse_mode="Markdown",
            )
        elif "limit reached" in err:
            await update.message.reply_text("\u26a0\ufe0f Limit u\u017cy\u0107 tego kodu zosta\u0142 osi\u0105gni\u0119ty.")
        elif "expired" in err:
            await update.message.reply_text("\u26a0\ufe0f Ten kod wygas\u0142.")
        elif "disabled" in err:
            await update.message.reply_text("\u26a0\ufe0f Ten kod jest nieaktywny.")
        else:
            await update.message.reply_text(f"\u274c B\u0142\u0105d: {err}")
        return

    await update.message.reply_text(
        f"\u2705 *Kod wykorzystany!*\n\n"
        f"\U0001f4b5 Dodano: *{_fmt_pln(result['added'])}*\n"
        f"\U0001f4b0 Nowe saldo: *{_fmt_pln(result['newBalance'])}*",
        parse_mode="Markdown",
    )


# ── /history ───────────────────────────────────────────────────────────

def _fmt_date(iso: str) -> str:
    if isinstance(iso, str) and "T" in iso:
        return iso.split("T")[0]
    return str(iso)


async def cmd_history(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    log.info("/history from %s", update.effective_user.id)
    tid = str(update.effective_user.id)
    try:
        data = await api.get_history(tid)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            await update.message.reply_text(
                "\U0001f464 Nie masz konta. Użyj /start — jeśli już to zrobiłeś, sprawdź połączenie bota z serwerem."
            )
        else:
            await update.message.reply_text(
                "\u26a0\ufe0f Serwer chwilowo niedostępny. Spróbuj za chwilę."
            )
        return
    except Exception as e:
        log.warning("get_history failed: %s", e)
        await update.message.reply_text(
            "\u274c Nie udało się pobrać historii. Spróbuj ponownie."
        )
        return

    deposits = data.get("deposits", [])
    payouts = data.get("payouts", [])
    bets = data.get("bets", [])
    bonuses = data.get("bonuses", [])

    if not deposits and not payouts and not bets and not bonuses:
        await update.message.reply_text(
            "\U0001f4ed Brak historii. Zacznij od /deposit."
        )
        return

    lines = ["\U0001f4dc *Historia konta:*"]

    if deposits:
        lines.append("\n\U0001f4e5 *Wpłaty:*")
        for d in deposits[:10]:
            nat = _fmt_crypto_native(d.get("amount"), d.get("currency", ""))
            cur = d.get("currency", "")
            extra = ""
            aud = d.get("amountPln")
            if aud is not None:
                try:
                    if float(aud) > 0:
                        extra = f" (~ {_fmt_pln(aud)})"
                except (TypeError, ValueError):
                    pass
            lines.append(
                f"  • {_fmt_date(d['createdAt'])} — {cur} *{nat}*{extra} — _{d['status']}_"
            )

    if payouts:
        lines.append("\n\U0001f4e4 *Wypłaty:*")
        for p in payouts[:10]:
            lines.append(
                f"  • {_fmt_date(p['createdAt'])} — *{_fmt_pln(p['amount'])}* "
                f"({p['currency']}) — _{p['status']}_"
            )

    if bets:
        lines.append("\n\U0001f3af *Bety:*")
        for b in bets[:15]:
            icon = "✅" if b["status"] == "won" else "❌" if b["status"] == "lost" else "•"
            lines.append(
                f"  {icon} {_fmt_date(b['createdAt'])} — {b['betTitle']} "
                f"(*{b['optionLabel']}*) — {_fmt_pln(b['amount'])}"
            )

    if bonuses:
        lines.append("\n\U0001f381 *Bonusy z kod\u00f3w:*")
        for b in bonuses[:10]:
            lines.append(
                f"  • {_fmt_date(b['createdAt'])} — `{b['code']}` — *+{_fmt_pln(b['amountPln'])}*"
            )

    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


# ── /stats ─────────────────────────────────────────────────────────────

async def cmd_stats(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    log.info("/stats from %s", update.effective_user.id)
    tid = str(update.effective_user.id)
    try:
        info = await api.get_user_info(tid)
    except Exception:
        await update.message.reply_text("\U0001f464 Nie masz konta. Użyj /start.")
        return

    since = _fmt_date(info.get("memberSince", "—"))
    total = info.get("totalBets", 0)
    won = info.get("wonBets", 0)
    win_rate = (won / total * 100) if total else 0.0

    await update.message.reply_text(
        f"\U0001f4ca *Twoje statystyki all-time*\n\n"
        f"\U0001f4b0 Saldo: *{_fmt_pln(info['balance'])}*\n"
        f"\U0001f3af Bety postawione: *{total}*\n"
        f"\u2705 Bety wygrane: *{won}*\n"
        f"\U0001f4c8 Win-rate: *{win_rate:.1f}%*\n"
        f"\U0001f4e5 \u0141\u0105czne wp\u0142aty: *{_fmt_pln(info['totalDeposited'])}*\n"
        f"\U0001f4e4 \u0141\u0105czne wyp\u0142aty: *{_fmt_pln(info['totalWithdrawn'])}*\n\n"
        f"\U0001f4c5 Konto od: {since}",
        parse_mode="Markdown",
    )


# ── Application factory ───────────────────────────────────────────────

async def _error_handler(update: object, context: ContextTypes.DEFAULT_TYPE):
    log.error("Exception while handling update:\n%s", traceback.format_exc())


def build_app(token: str, backend_url: str, bot_api_key: str) -> Application:
    global api
    api = BackendAPI(backend_url, bot_api_key)
    log.info("API client → %s", backend_url)

    app = Application.builder().token(token).build()
    app.add_error_handler(_error_handler)

    deposit_conv = ConversationHandler(
        entry_points=[CommandHandler("deposit", cmd_deposit)],
        states={DEPOSIT_CURRENCY: [CallbackQueryHandler(deposit_currency, pattern="^cur:")]},
        fallbacks=[CommandHandler("start", cmd_start)],
        per_message=False,
    )

    payout_conv = ConversationHandler(
        entry_points=[CommandHandler("payout", cmd_payout)],
        states={
            PAYOUT_CURRENCY: [CallbackQueryHandler(payout_currency, pattern="^cur:")],
            PAYOUT_WALLET: [MessageHandler(filters.TEXT & ~filters.COMMAND, payout_wallet)],
            PAYOUT_AMOUNT: [MessageHandler(filters.TEXT & ~filters.COMMAND, payout_amount)],
            PAYOUT_CODE: [MessageHandler(filters.TEXT & ~filters.COMMAND, payout_code)],
        },
        fallbacks=[CommandHandler("start", cmd_start)],
        per_message=False,
    )

    bet_conv = ConversationHandler(
        entry_points=[CommandHandler("bet", cmd_bet)],
        states={
            BET_OPTION: [MessageHandler(filters.TEXT & ~filters.COMMAND, bet_option)],
            BET_AMOUNT: [MessageHandler(filters.TEXT & ~filters.COMMAND, bet_amount)],
        },
        fallbacks=[CommandHandler("start", cmd_start)],
        per_message=False,
    )

    delete_conv = ConversationHandler(
        entry_points=[CommandHandler("delete", cmd_delete)],
        states={DELETE_CONFIRM: [CallbackQueryHandler(delete_confirm, pattern="^delete:")]},
        fallbacks=[CommandHandler("start", cmd_start)],
        per_message=False,
    )

    start_conv = ConversationHandler(
        entry_points=[CommandHandler("start", cmd_start)],
        states={USERNAME_CODE: [MessageHandler(filters.TEXT & ~filters.COMMAND, username_code)]},
        fallbacks=[CommandHandler("cancel", cmd_cancel)],
        per_message=False,
    )

    app.add_handler(deposit_conv)
    app.add_handler(payout_conv)
    app.add_handler(bet_conv)
    app.add_handler(delete_conv)
    app.add_handler(start_conv)
    app.add_handler(CommandHandler("me", cmd_me))
    app.add_handler(CommandHandler("saldo", cmd_saldo))
    app.add_handler(CommandHandler("code", cmd_code))
    app.add_handler(CommandHandler("mybets", cmd_mybets))
    app.add_handler(CommandHandler("history", cmd_history))
    app.add_handler(CommandHandler("stats", cmd_stats))
    app.add_handler(CommandHandler("info", cmd_info))

    return app
