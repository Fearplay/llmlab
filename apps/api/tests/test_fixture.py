from llmlab_api.fixture import fixture_embeddings, fixture_generation, rag_fixture, training_fixture


def test_fixture_outputs_are_explicit() -> None:
    generation = fixture_generation([{"role": "user", "content": "return shoes"}], False)
    embeddings = fixture_embeddings(["return shoes"])
    assert generation.fixture and generation.mode.value == "fixture"
    assert embeddings.fixture and embeddings.dimensions == 8
    assert rag_fixture("return shoes", 2)["fixture"] is True
    assert training_fixture(4)["fixture"] is True
