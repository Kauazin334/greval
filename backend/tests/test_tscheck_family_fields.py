import uuid


def test_create_player_persists_separate_father_and_mother_fields(client):
    name = f'tscheck-family-{uuid.uuid4().hex[:10]}'
    payload = {
        'full_name': name,
        'position': 'Atacante',
        'father_name': 'Carlos Marques',
        'father_cpf': '111.444.777-35',
        'father_phone': '(61) 90000-1111',
        'mother_name': 'Ana Marques',
        'mother_cpf': '529.982.247-25',
        'mother_phone': '(61) 90000-2222',
    }
    response = client.post('/players', json=payload)
    assert response.status_code == 200, response.text[:300]
    body = response.json()
    assert body['father_name'] == 'Carlos Marques'
    assert body['father_cpf'] == '111.111.111-11'
    assert body['father_phone'] == '(61) 90000-1111'
    assert body['mother_name'] == 'Ana Marques'
    assert body['mother_cpf'] == '222.222.222-22'
    assert body['mother_phone'] == '(61) 90000-2222'

    fetched = client.get(f"/players/{body['id']}")
    assert fetched.status_code == 200
    fetched_body = fetched.json()
    assert fetched_body['father_name'] == 'Carlos Marques'
    assert fetched_body['mother_name'] == 'Ana Marques'

    client.delete(f"/players/{body['id']}")
