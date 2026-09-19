from llmlab_api.fixture import fixture_embeddings, fixture_generation, training_fixture


def test_fixture_outputs_are_explicit() -> None:
    generation = fixture_generation([{"role": "user", "content": "return shoes"}], False)
    embeddings = fixture_embeddings(["return shoes"])
    assert generation.fixture and generation.mode.value == "fixture"
    assert embeddings.fixture and embeddings.dimensions == 8
    assert training_fixture(4)["fixture"] is True
