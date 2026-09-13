import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "Ayni AI Agent Service"
    VERSION: str = "1.0.0"
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    HSK_RPC_URL: str = os.getenv("HSK_RPC_URL", "https://testnet.hsk.xyz")
    CHAIN_ID: int = int(os.getenv("CHAIN_ID", "133"))
    AGENT_PRIVATE_KEY: str = os.getenv("AGENT_PRIVATE_KEY", "0x0000000000000000000000000000000000000000000000000000000000000001")
    AGENT_REGISTRY_ADDRESS: str = os.getenv("AGENT_REGISTRY_ADDRESS", "0x0000000000000000000000000000000000000000")

settings = Settings()
