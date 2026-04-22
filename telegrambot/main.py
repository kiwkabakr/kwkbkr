import os
import logging
from dotenv import load_dotenv
from bot import build_app

load_dotenv()

logging.basicConfig(
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    level=logging.INFO,
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("telegram.ext.Updater").setLevel(logging.DEBUG)
logging.getLogger("telegram.ext.Application").setLevel(logging.DEBUG)

BOT_TOKEN = os.environ["BOT_TOKEN"]
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")
BOT_API_KEY = os.environ["BOT_API_KEY"]

application = build_app(BOT_TOKEN, BACKEND_URL, BOT_API_KEY)
print(f"Bot started. Backend: {BACKEND_URL}")
print(f"Token: ...{BOT_TOKEN[-8:]}")
application.run_polling(drop_pending_updates=True)
