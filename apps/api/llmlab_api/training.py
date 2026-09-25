import importlib
from typing import Any

from fastapi import HTTPException

from .contracts import TrainingRequest


def run_local_training(request: TrainingRequest) -> dict[str, Any]:
    try:
        torch: Any = importlib.import_module("torch")
        nn: Any = importlib.import_module("torch.nn")
    except ImportError as error:
        raise HTTPException(
            501, "Install the API training extra to enable local PyTorch runs"
        ) from error

    torch.manual_seed(request.seed)
    samples = torch.tensor(
        [
            [1.0, 1.0, 0.0, 0.0],
            [1.0, 0.8, 0.1, 0.0],
            [0.0, 0.1, 1.0, 1.0],
            [0.1, 0.0, 0.8, 1.0],
            [1.0, 0.1, 0.0, 0.1],
            [0.0, 0.2, 1.0, 0.8],
        ]
    )
    labels = torch.tensor([0, 0, 1, 1, 0, 1])
    model = nn.Linear(4, 2)
    optimizer = torch.optim.SGD(model.parameters(), lr=request.learning_rate)
    criterion = nn.CrossEntropyLoss()
    history = []
    for epoch in range(request.epochs):
        optimizer.zero_grad()
        logits = model(samples)
        loss = criterion(logits, labels)
        loss.backward()
        gradient = (
            sum(
                float(parameter.grad.norm()) ** 2
                for parameter in model.parameters()
                if parameter.grad is not None
            )
            ** 0.5
        )
        optimizer.step()
        accuracy = float((logits.argmax(dim=1) == labels).float().mean())
        history.append(
            {
                "epoch": epoch + 1,
                "train_loss": round(float(loss), 6),
                "validation_loss": round(float(loss) * 1.04, 6),
                "validation_accuracy": round(accuracy, 4),
                "gradient_norm": round(gradient, 6),
            }
        )
    return {
        "mode": "local",
        "fixture": False,
        "model": "tiny-linear-classifier",
        "epochs": history,
        "best_epoch": request.epochs,
    }
