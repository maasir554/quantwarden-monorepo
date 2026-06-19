import argparse
import warnings
import uvicorn


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Start OneForAll FastAPI server")
    parser.add_argument(
        "--port",
        "-p",
        type=int,
        default=8002,
        help="Port to run the API server on (default: 8002)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    # OneForAll internals (or transitive libs) may leave multiprocessing semaphores
    # registered at interpreter shutdown on newer Python versions. This warning is
    # noisy but non-fatal for API shutdown.
    warnings.filterwarnings(
        "ignore",
        message=r"resource_tracker: There appear to be .* leaked semaphore objects to clean up at shutdown",
        category=UserWarning,
    )

    args = parse_args()
    print(f"Starting API server at http://localhost:{args.port}")
    print(f"OpenAPI docs: http://localhost:{args.port}/docs")
    uvicorn.run("fastapi_app.main:app", host="0.0.0.0", port=args.port, reload=False)
