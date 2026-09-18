from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./llmlab.db"
    redis_url: str = "redis://localhost:6379/0"
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434/v1"
    openai_compatible_base_url: str = ""
    openai_compatible_api_key: str = ""
    git_sha: str = "dev"
    app_environment: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
