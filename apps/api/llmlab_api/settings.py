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
    rag_knowledge_dir: str = "knowledge/en"
    rag_index_dir: str = "apps/api/data/rag-index"
    rag_embedding_model: str = "BAAI/bge-m3"
    rag_fallback_embedding_model: str = "llmlab/multilingual-hash-v1"
    rag_allow_model_download: bool = False
    rag_chunk_target_tokens: int = 450
    rag_chunk_overlap_tokens: int = 80
    rag_dense_weight: float = 0.85
    rag_lexical_weight: float = 0.15
    rag_score_threshold: float = 0.30
    rag_fallback_score_threshold: float = 0.14
    rag_reranker_enabled: bool = False
    rag_reranker_model: str = "BAAI/bge-reranker-v2-m3"
    rag_local_model: str = "qwen3.5:9b"


@lru_cache
def get_settings() -> Settings:
    return Settings()
