import uuid


def test_delete_player_removes_created_row(client):
    name = f'tscheck-delete-{uuid.uuid4().hex[:10]}'
    created = client.post('/players', json={'full_name': name, 'position': 'Zagueiro'})
    assert created.status_code == 200, created.text[:300]
    player_id = created.json()['id']
    deleted = client.delete(f'/players/{player_id}')
    assert deleted.status_code == 204, deleted.text[:300]
    missing = client.get(f'/players/{player_id}')
    assert missing.status_code == 404, missing.text[:300]
