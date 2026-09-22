import uuid


def test_update_player_changes_field(client):
    name = f'tscheck-edit-{uuid.uuid4().hex[:10]}'
    created = client.post('/players', json={'full_name': name, 'position': 'Meia'})
    assert created.status_code == 200, created.text[:300]
    body = created.json(); player_id = body['id']
    try:
        updated_payload = {key: value for key, value in body.items() if key not in {'id', 'created_at', 'updated_at'}}
        updated_payload['nickname'] = 'Campo Atualizado'
        response = client.put(f'/players/{player_id}', json=updated_payload)
        assert response.status_code == 200, response.text[:300]
        assert response.json()['nickname'] == 'Campo Atualizado'
    finally:
        client.delete(f'/players/{player_id}')
