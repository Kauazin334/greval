import uuid


def test_create_player_persists_required_fields(client):
    name = f'tscheck-create-{uuid.uuid4().hex[:10]}'
    response = client.post('/players', json={'full_name': name, 'position': 'Atacante', 'nickname': 'NovoQA'})
    assert response.status_code == 200, response.text[:300]
    body = response.json()
    assert body['full_name'] == name and body['position'] == 'Atacante'
    fetched = client.get(f"/players/{body['id']}")
    assert fetched.status_code == 200 and fetched.json()['id'] == body['id']
    client.delete(f"/players/{body['id']}")
