import uuid


def test_empty_safe_roster_and_manual_registration(client):
    listing = client.get('/players')
    assert listing.status_code == 200, listing.text[:300]
    name = f'tscheck-empty-safe-{uuid.uuid4().hex[:10]}'
    created = client.post('/players', json={'full_name': name, 'position': 'Atacante', 'category': '09'})
    assert created.status_code == 200, created.text[:300]
    body = created.json()
    assert body['full_name'] == name and body['category'] == '09'
    refreshed = client.get('/players')
    assert refreshed.status_code == 200 and any(row['id'] == body['id'] for row in refreshed.json()['items'])
    deleted = client.delete(f"/players/{body['id']}")
    assert deleted.status_code == 204
