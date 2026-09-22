import uuid


def test_player_documents_upload_and_download(client):
    name = f'tscheck-docs-{uuid.uuid4().hex[:10]}'
    created = client.post('/players', json={'full_name': name, 'position': 'Meia', 'category': '09'})
    assert created.status_code == 200, created.text[:300]
    player_id = created.json()['id']
    pdf = b'%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n'
    try:
        for kind in ('rg', 'cpf', 'birth_certificate'):
            uploaded = client.post(f'/players/{player_id}/documents', data={'document_type': kind}, files={'file': (f'{kind}.pdf', pdf, 'application/pdf')})
            assert uploaded.status_code == 200, uploaded.text[:300]
        detail = client.get(f'/players/{player_id}')
        assert detail.status_code == 200
        assert {doc['document_type'] for doc in detail.json()['documents']} == {'rg', 'cpf', 'birth_certificate'}
        for kind in ('rg', 'cpf', 'birth_certificate'):
            downloaded = client.get(f'/players/{player_id}/documents/{kind}')
            assert downloaded.status_code == 200 and downloaded.content.startswith(b'%PDF'), downloaded.text[:100]
    finally:
        client.delete(f'/players/{player_id}')
