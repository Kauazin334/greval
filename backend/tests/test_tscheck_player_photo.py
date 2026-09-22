import io
import uuid


def test_photo_upload_persists_and_downloads(client):
    name = f'tscheck-photo-{uuid.uuid4().hex[:10]}'
    created = client.post('/players', json={'full_name': name, 'position': 'Zagueiro'})
    assert created.status_code == 200, created.text[:300]
    player_id = created.json()['id']

    tiny_png = bytes.fromhex(
        '89504e470d0a1a0a0000000d494844520000000100000001080600000'
        '01f15c4890000000a49444154789c6300010000050001'
        '0d0a2db40000000049454e44ae426082'
    )
    files = {'file': ('photo.png', io.BytesIO(tiny_png), 'image/png')}
    upload = client.post(f'/players/{player_id}/photo', files=files)
    assert upload.status_code == 200, upload.text[:300]
    upload_body = upload.json()
    assert upload_body['photo_url']

    fetched = client.get(f'/players/{player_id}')
    assert fetched.status_code == 200
    assert fetched.json()['photo_url'] == upload_body['photo_url']

    download = client.get(f'/players/{player_id}/photo')
    assert download.status_code == 200
    assert download.headers['content-type'].startswith('image/')

    client.delete(f'/players/{player_id}')
