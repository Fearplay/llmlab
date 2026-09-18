import pytest

from llmlab_api.rag import chunk_text, retrieve


def test_chunking_is_stable_and_overlapping() -> None:
    chunks = chunk_text("one two three four five six", size=4, overlap=2)
    assert [chunk.text for chunk in chunks] == [
        "one two three four",
        "three four five six",
        "five six",
    ]


def test_invalid_overlap() -> None:
    with pytest.raises(ValueError):
        chunk_text("content", size=4, overlap=4)


def test_retrieval_ranks_matching_chunk_first() -> None:
    chunks = chunk_text(
        "refund policy footwear divider shipping carrier tracking", size=3, overlap=0
    )
    ranked = retrieve("footwear refund", chunks, top_k=1)
    assert ranked[0][0].index == 0
    assert ranked[0][1] > 0
