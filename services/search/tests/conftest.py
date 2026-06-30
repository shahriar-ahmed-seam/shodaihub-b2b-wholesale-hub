"""Shared pytest fixtures, including the ElasticSearch testcontainer.

ES-backed tests are guarded: if Docker is unavailable, the ``es_client`` fixture skips the
test gracefully rather than failing the suite.
"""

from __future__ import annotations

import asyncio

import pytest

ES_IMAGE = "docker.elastic.co/elasticsearch/elasticsearch:8.15.0"


def _docker_available() -> bool:
    try:
        import docker  # provided transitively by testcontainers

        client = docker.from_env()
        client.ping()
        return True
    except Exception:
        return False


DOCKER_AVAILABLE = _docker_available()


# ElasticSearch on a cold single-node container can take several minutes to answer on :9200
# (JVM warmup + cluster bootstrap), well past testcontainers' 120s HTTP-wait default. Give it a
# generous startup budget so a slow-but-healthy node is not mistaken for a failure.
ES_STARTUP_TIMEOUT_SECONDS = 360


@pytest.fixture(scope="session")
def es_url() -> str:
    """Start a single-node, security-disabled ElasticSearch container for the session.

    If Docker is unavailable, or the container cannot become ready in this environment, the
    fixture skips the dependent tests gracefully rather than failing the suite.
    """
    if not DOCKER_AVAILABLE:
        pytest.skip("Docker is not available; skipping ElasticSearch-backed tests.")

    from testcontainers.core.wait_strategies import HttpWaitStrategy
    from testcontainers.elasticsearch import ElasticSearchContainer

    container = (
        ElasticSearchContainer(ES_IMAGE)
        .with_env("discovery.type", "single-node")
        .with_env("xpack.security.enabled", "false")
        .with_env("ES_JAVA_OPTS", "-Xms512m -Xmx512m")
        .waiting_for(
            HttpWaitStrategy(9200).for_status_code(200).with_startup_timeout(
                ES_STARTUP_TIMEOUT_SECONDS
            )
        )
    )
    try:
        container.start()
    except Exception as exc:  # noqa: BLE001 - environment can't host ES; skip, don't fail
        try:
            container.stop()
        except Exception:  # noqa: BLE001 - best-effort cleanup of a partially-started container
            pass
        pytest.skip(f"ElasticSearch container could not start; skipping ES-backed tests: {exc}")

    try:
        host = container.get_container_host_ip()
        port = container.get_exposed_port(container.port)
        yield f"http://{host}:{port}"
    finally:
        container.stop()


@pytest.fixture(scope="session")
def es_loop():
    """A dedicated event loop the synchronous Hypothesis tests drive ES coroutines on."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def es_client(es_url: str, es_loop):
    """Session-scoped async ElasticSearch client bound to ``es_loop``."""
    from app.es_client import create_client

    client = create_client(es_url)
    yield client
    es_loop.run_until_complete(client.close())
