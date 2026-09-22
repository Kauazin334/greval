import httpx


def test_players_api_rejects_anonymous_access(backend_url):
    with httpx.Client(base_url=f'{backend_url}/api', timeout=30.0) as client:
        response = client.get('/players')
    assert response.status_code == 401
