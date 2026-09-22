import uuid


def test_player_detail_returns_profile_data(client):
    name = f'tscheck-profile-{uuid.uuid4().hex[:10]}'
    response = client.post('/players', json={'full_name': name, 'position': 'Goleiro', 'category': 'Sub-17', 'height_cm': 190, 'medical_notes': 'Acompanhamento QA', 'contract_number': 'QA-1', 'guardian_name': 'Responsável QA', 'speed': 82})
    assert response.status_code == 200, response.text[:300]
    player_id = response.json()['id']
    try:
        detail = client.get(f'/players/{player_id}')
        assert detail.status_code == 200, detail.text[:300]
        body = detail.json()
        assert body['full_name'] == name and body['height_cm'] == 190 and body['speed'] == 82
        assert body['guardian_name'] == 'Responsável QA'
    finally:
        client.delete(f'/players/{player_id}')
