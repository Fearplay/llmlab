from llmlab_api.cache import cache_key


def test_cache_key_is_canonical_and_hides_content() -> None:
    first = cache_key("generation", {"model": "m", "prompt": "private text"})
    second = cache_key("generation", {"prompt": "private text", "model": "m"})
    assert first == second
    assert "private text" not in first


def test_cache_versions_do_not_collide() -> None:
    assert cache_key("generation", {"model": "m"}, version=1) != cache_key(
        "generation", {"model": "m"}, version=2
    )
