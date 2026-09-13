import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from root or local directory
root_env = Path(__file__).resolve().parent.parent.parent / ".env"
if root_env.exists():
    load_dotenv(dotenv_path=root_env)
load_dotenv()

class Settings:
    PROJECT_NAME: str = "Ayni AI Agent Service"
    VERSION: str = "1.0.0"
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    HSK_RPC_URL: str = os.getenv("HSK_RPC_URL", "https://testnet.hsk.xyz")
    CHAIN_ID: int = int(os.getenv("CHAIN_ID", "133"))
    AGENT_PRIVATE_KEY: str = os.getenv("AGENT_PRIVATE_KEY", "")
    AGENT_REGISTRY_ADDRESS: str = os.getenv("AYNI_REGISTRY_ADDRESS", os.getenv("AGENT_REGISTRY_ADDRESS", "0x0000000000000000000000000000000000000000"))

settings = Settings()
