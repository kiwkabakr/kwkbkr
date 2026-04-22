import httpx


class BackendAPI:
    def __init__(self, base_url: str, api_key: str, timeout: int = 10):
        self._base = base_url.rstrip("/")
        self._headers = {"X-Bot-Key": api_key, "Content-Type": "application/json"}
        self._timeout = timeout

    async def _get(self, path: str):
        async with httpx.AsyncClient(timeout=self._timeout) as c:
            r = await c.get(f"{self._base}{path}", headers=self._headers)
            r.raise_for_status()
            return r.json()

    async def _post(self, path: str, data: dict | None = None):
        async with httpx.AsyncClient(timeout=self._timeout) as c:
            r = await c.post(f"{self._base}{path}", headers=self._headers, json=data or {})
            r.raise_for_status()
            return r.json()

    async def _delete(self, path: str):
        async with httpx.AsyncClient(timeout=self._timeout) as c:
            r = await c.delete(f"{self._base}{path}", headers=self._headers)
            r.raise_for_status()
            return r.json()

    # ── Users ──────────────────────────────────────────────

    async def register_user(self, telegram_id: str, username: str | None, first_name: str | None):
        return await self._post("/api/bot/users", {
            "telegramId": str(telegram_id),
            "username": username or "",
            "firstName": first_name or "",
        })

    async def get_user(self, telegram_id: str):
        return await self._get(f"/api/bot/users/{telegram_id}")

    async def get_passkey(self, telegram_id: str):
        return await self._get(f"/api/bot/users/{telegram_id}/passkey")

    async def get_user_info(self, telegram_id: str):
        return await self._get(f"/api/bot/users/{telegram_id}/info")

    async def get_history(self, telegram_id: str):
        return await self._post("/api/bot/users/history", {"telegramId": str(telegram_id)})

    async def sync_username(self, telegram_id: str, new_username: str, code: str):
        return await self._post("/api/bot/users/sync-username", {
            "telegramId": str(telegram_id),
            "newUsername": new_username,
            "verificationCode": code,
        })

    async def redeem_code(self, telegram_id: str, code: str):
        return await self._post("/api/bot/redeem", {
            "telegramId": str(telegram_id),
            "code": code,
        })

    async def delete_user(self, telegram_id: str):
        return await self._delete(f"/api/bot/users/{telegram_id}")

    # ── Deposits & Payouts ─────────────────────────────────

    async def create_deposit(self, telegram_id: str, currency: str):
        return await self._post("/api/bot/deposits", {
            "telegramId": str(telegram_id),
            "currency": currency,
        })

    async def request_payout(self, telegram_id: str, currency: str, wallet_address: str, amount: float, verification_code: str):
        return await self._post("/api/bot/payouts", {
            "telegramId": str(telegram_id),
            "currency": currency,
            "amount": amount,
            "walletAddress": wallet_address,
            "verificationCode": verification_code,
        })

    # ── Bets ───────────────────────────────────────────────

    async def get_bet(self, short_id: str):
        return await self._get(f"/api/bot/bets/{short_id}")

    async def place_bet(self, telegram_id: str, bet_short_id: str, option_id: str, amount: float):
        return await self._post("/api/bot/bets/place", {
            "telegramId": str(telegram_id),
            "betShortId": bet_short_id,
            "optionId": option_id,
            "amount": amount,
        })

    async def get_user_bets(self, telegram_id: str):
        return await self._get(f"/api/bot/users/{telegram_id}/bets")
