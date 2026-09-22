import uuid


def test_masked_cpf_and_phone_fields_persist(client):
    name = f'tscheck-mask-{uuid.uuid4().hex[:10]}'
    payload = {
        'full_name': name,
        'position': 'Atacante',
        'cpf': '123.456.789-09',
        'father_name': 'Pai Teste',
        'father_cpf': '111.444.777-35',
        'father_phone': '(61) 98888-1111',
        'mother_name': 'Mae Teste',
        'mother_cpf': '529.982.247-25',
        'mother_phone': '(61) 97777-2222',
    }
    response = client.post('/players', json=payload)
    assert response.status_code == 200, response.text[:300]
    body = response.json()
    assert body['cpf'] == '123.456.789-09'
    assert body['father_cpf'] == '111.444.777-35'
    assert body['father_phone'] == '(61) 98888-1111'
    assert body['mother_cpf'] == '529.982.247-25'
    assert body['mother_phone'] == '(61) 97777-2222'

    player_id = body['id']
    fetched = client.get(f'/players/{player_id}')
    assert fetched.status_code == 200
    fetched_body = fetched.json()
    assert fetched_body['cpf'] == '123.456.789-09'
    assert fetched_body['father_cpf'] == '111.444.777-35'
    assert fetched_body['father_phone'] == '(61) 98888-1111'
    assert fetched_body['mother_cpf'] == '529.982.247-25'
    assert fetched_body['mother_phone'] == '(61) 97777-2222'

    client.delete(f'/players/{player_id}')
