import uuid


def test_players_search_and_filters(client):
    name = f'tscheck-filters-{uuid.uuid4().hex[:10]}'
    payload = {'full_name': name, 'nickname': 'FiltroQA', 'position': 'Meia', 'category': 'Sub-20', 'status': 'Ativo'}
    created = client.post('/players', json=payload)
    assert created.status_code == 200, created.text[:300]
    player_id = created.json()['id']
    try:
        for params in ({'search': 'FiltroQA'}, {'category': 'Sub-20'}, {'position': 'Meia'}, {'status': 'Ativo'}):
            response = client.get('/players', params=params)
            assert response.status_code == 200, response.text[:300]
            assert any(row['id'] == player_id for row in response.json()['items'])
    finally:
        client.delete(f'/players/{player_id}')
