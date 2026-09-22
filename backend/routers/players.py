from datetime import datetime, timezone
import re
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from fastapi.responses import FileResponse
from pymongo import ReturnDocument

from lib.db import db
from models.players import DocumentUploadResponse, DvdUploadResponse, PhotoUploadResponse, Player, PlayerCreate, PlayerPage


router = APIRouter(prefix='/players', tags=['players'])
UPLOAD_DIR = Path(__file__).resolve().parents[1] / 'uploads'
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
DOCUMENT_LABELS = {'rg': 'RG', 'cpf': 'CPF', 'birth_certificate': 'Certidão de nascimento'}
MAX_PHOTO_BYTES = 5 * 1024 * 1024
MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
MAX_DVD_BYTES = 100 * 1024 * 1024


def _player_from_document(document: dict) -> Player:
    document.pop('_id', None)
    return Player(**document)


def _safe_filename(name: str | None, fallback: str) -> str:
    value = Path(name or fallback).name
    value = re.sub(r'[^A-Za-z0-9._ -]', '_', value).strip(' .')
    return (value or fallback)[:120]


def _remove_file(storage_name: str | None) -> None:
    if not storage_name or Path(storage_name).name != storage_name:
        return
    path = UPLOAD_DIR / storage_name
    if path.exists():
        path.unlink()


def _image_extension(contents: bytes) -> str | None:
    if contents.startswith(b'\xff\xd8\xff'):
        return '.jpg'
    if contents.startswith(b'\x89PNG\r\n\x1a\n'):
        return '.png'
    if contents.startswith(b'RIFF') and contents[8:12] == b'WEBP':
        return '.webp'
    return None


def _video_extension(contents: bytes) -> str | None:
    if contents.startswith(b'\x1aE\xdf\xa3'):
        return '.webm'
    if contents.startswith(b'RIFF') and contents[8:12] == b'AVI ':
        return '.avi'
    if len(contents) >= 12 and contents[4:8] == b'ftyp':
        return '.mov' if contents[8:12] == b'qt  ' else '.mp4'
    return None


def _attachment(path: Path, media_type: str, filename: str) -> FileResponse:
    return FileResponse(path, media_type=media_type, filename=filename, content_disposition_type='attachment', headers={'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'})


@router.get('', response_model=PlayerPage)
async def list_players(
    search: str | None = Query(default=None, max_length=100),
    category: str | None = Query(default=None, max_length=20),
    position: str | None = Query(default=None, max_length=50),
    status: str | None = Query(default=None, max_length=30),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    query: dict = {}
    if search:
        safe_search = re.escape(search)
        query['$or'] = [{'full_name': {'$regex': safe_search, '$options': 'i'}}, {'nickname': {'$regex': safe_search, '$options': 'i'}}]
    for field, value in {'category': category, 'position': position, 'status': status}.items():
        if value:
            query[field] = value
    total = await db.players.count_documents(query)
    documents = await db.players.find(query).sort('full_name', 1).skip(offset).limit(limit).to_list(limit)
    return PlayerPage(items=[_player_from_document(document) for document in documents], total=total, limit=limit, offset=offset)


@router.post('', response_model=Player)
async def create_player(input: PlayerCreate):
    player = Player(**input.model_dump())
    await db.players.insert_one(player.model_dump())
    return player


@router.get('/{player_id}', response_model=Player)
async def get_player(player_id: UUID):
    document = await db.players.find_one({'id': str(player_id)})
    if not document:
        raise HTTPException(status_code=404, detail='Jogador não encontrado')
    return _player_from_document(document)


@router.put('/{player_id}', response_model=Player)
async def update_player(player_id: UUID, input: PlayerCreate):
    values = input.model_dump()
    values['updated_at'] = datetime.now(timezone.utc).isoformat()
    document = await db.players.find_one_and_update({'id': str(player_id)}, {'$set': values}, return_document=ReturnDocument.AFTER)
    if not document:
        raise HTTPException(status_code=404, detail='Jogador não encontrado')
    return _player_from_document(document)


@router.delete('/{player_id}', status_code=204)
async def delete_player(player_id: UUID):
    document = await db.players.find_one_and_delete({'id': str(player_id)})
    if not document:
        raise HTTPException(status_code=404, detail='Jogador não encontrado')
    _remove_file(document.get('photo_storage_name'))
    _remove_file(document.get('dvd_storage_name'))
    for item in document.get('documents', []):
        _remove_file(item.get('storage_name'))
    return Response(status_code=204)


@router.post('/{player_id}/photo', response_model=PhotoUploadResponse)
async def upload_player_photo(player_id: UUID, file: UploadFile = File(...)):
    contents = await file.read(MAX_PHOTO_BYTES + 1)
    extension = _image_extension(contents)
    if not extension:
        raise HTTPException(status_code=400, detail='Envie uma imagem JPG, PNG ou WEBP válida')
    if len(contents) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail='A foto deve ter no máximo 5 MB')
    storage_name = f'{player_id}_photo_{uuid4().hex}{extension}'
    path = UPLOAD_DIR / storage_name
    path.write_bytes(contents)
    try:
        player = await db.players.find_one_and_update({'id': str(player_id)}, {'$set': {'photo_url': f'/api/players/{player_id}/photo', 'photo_storage_name': storage_name}}, return_document=ReturnDocument.BEFORE)
    except Exception:
        _remove_file(storage_name)
        raise
    if not player:
        _remove_file(storage_name)
        raise HTTPException(status_code=404, detail='Jogador não encontrado')
    _remove_file(player.get('photo_storage_name'))
    return PhotoUploadResponse(photo_url=f'/api/players/{player_id}/photo', filename=_safe_filename(file.filename, f'foto{extension}'), size_bytes=len(contents))


@router.get('/{player_id}/photo')
async def download_player_photo(player_id: UUID):
    player = await db.players.find_one({'id': str(player_id)})
    if not player or not player.get('photo_storage_name'):
        raise HTTPException(status_code=404, detail='Foto não encontrada')
    path = UPLOAD_DIR / player['photo_storage_name']
    if not path.exists():
        raise HTTPException(status_code=404, detail='Arquivo de foto não encontrado')
    media_type = {'.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'}.get(path.suffix)
    if not media_type:
        raise HTTPException(status_code=404, detail='Arquivo inválido')
    return FileResponse(path, media_type=media_type, headers={'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'})


@router.post('/{player_id}/dvd', response_model=DvdUploadResponse)
async def upload_player_dvd(player_id: UUID, file: UploadFile = File(...)):
    if not await db.players.find_one({'id': str(player_id)}, {'_id': 1}):
        raise HTTPException(status_code=404, detail='Jogador não encontrado')
    prefix = await file.read(16)
    extension = _video_extension(prefix)
    if not extension:
        raise HTTPException(status_code=400, detail='Envie um vídeo MP4, MOV, WEBM ou AVI válido')
    storage_name = f'{player_id}_dvd_{uuid4().hex}{extension}'
    path = UPLOAD_DIR / storage_name
    size_bytes = len(prefix)
    try:
        with path.open('xb') as target:
            target.write(prefix)
            while chunk := await file.read(1024 * 1024):
                size_bytes += len(chunk)
                if size_bytes > MAX_DVD_BYTES:
                    raise HTTPException(status_code=413, detail='O DVD deve ter no máximo 100 MB')
                target.write(chunk)
        uploaded_at = datetime.now(timezone.utc).isoformat()
        player = await db.players.find_one_and_update(
            {'id': str(player_id)},
            {'$set': {
                'dvd_url': f'/api/players/{player_id}/dvd',
                'dvd_filename': _safe_filename(file.filename, f'dvd{extension}'),
                'dvd_uploaded_at': uploaded_at,
                'dvd_storage_name': storage_name,
            }},
            return_document=ReturnDocument.BEFORE,
        )
    except Exception:
        _remove_file(storage_name)
        raise
    if not player:
        _remove_file(storage_name)
        raise HTTPException(status_code=404, detail='Jogador não encontrado')
    _remove_file(player.get('dvd_storage_name'))
    return DvdUploadResponse(
        dvd_url=f'/api/players/{player_id}/dvd',
        filename=_safe_filename(file.filename, f'dvd{extension}'),
        size_bytes=size_bytes,
        uploaded_at=uploaded_at,
    )


@router.get('/{player_id}/dvd')
async def download_player_dvd(player_id: UUID):
    player = await db.players.find_one({'id': str(player_id)})
    if not player or not player.get('dvd_storage_name'):
        raise HTTPException(status_code=404, detail='DVD não encontrado')
    path = UPLOAD_DIR / player['dvd_storage_name']
    if not path.exists():
        raise HTTPException(status_code=404, detail='Arquivo de DVD não encontrado')
    media_type = {'.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.avi': 'video/x-msvideo'}.get(path.suffix)
    if not media_type:
        raise HTTPException(status_code=404, detail='Arquivo inválido')
    return FileResponse(path, media_type=media_type, headers={'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'})


@router.post('/{player_id}/documents', response_model=DocumentUploadResponse)
async def upload_player_document(player_id: UUID, document_type: str = Form(...), file: UploadFile = File(...)):
    if document_type not in DOCUMENT_LABELS:
        raise HTTPException(status_code=400, detail='Tipo de documento inválido')
    contents = await file.read(MAX_DOCUMENT_BYTES + 1)
    if len(contents) > MAX_DOCUMENT_BYTES:
        raise HTTPException(status_code=413, detail='O PDF deve ter no máximo 10 MB')
    if not contents.startswith(b'%PDF-'):
        raise HTTPException(status_code=400, detail='Envie um arquivo PDF válido')
    storage_name = f'{player_id}_{document_type}_{uuid4().hex}.pdf'
    (UPLOAD_DIR / storage_name).write_bytes(contents)
    uploaded = {'document_type': document_type, 'label': DOCUMENT_LABELS[document_type], 'filename': _safe_filename(file.filename, f'{document_type}.pdf'), 'size_bytes': len(contents), 'uploaded_at': datetime.now(timezone.utc).isoformat(), 'storage_name': storage_name}
    pipeline = [{'$set': {'documents': {'$concatArrays': [{'$filter': {'input': {'$ifNull': ['$documents', []]}, 'as': 'document', 'cond': {'$ne': ['$$document.document_type', document_type]}}}, [uploaded]]}}}]
    try:
        player = await db.players.find_one_and_update({'id': str(player_id)}, pipeline, return_document=ReturnDocument.BEFORE)
    except Exception:
        _remove_file(storage_name)
        raise
    if not player:
        _remove_file(storage_name)
        raise HTTPException(status_code=404, detail='Jogador não encontrado')
    previous = next((item for item in player.get('documents', []) if item.get('document_type') == document_type), None)
    if previous:
        _remove_file(previous.get('storage_name'))
    return DocumentUploadResponse(**{key: value for key, value in uploaded.items() if key != 'storage_name'})


@router.get('/{player_id}/documents/{document_type}')
async def download_player_document(player_id: UUID, document_type: str):
    if document_type not in DOCUMENT_LABELS:
        raise HTTPException(status_code=404, detail='Documento não encontrado')
    player = await db.players.find_one({'id': str(player_id)})
    document = next((item for item in (player or {}).get('documents', []) if item.get('document_type') == document_type), None)
    if not document or not document.get('storage_name'):
        raise HTTPException(status_code=404, detail='Documento não encontrado')
    path = UPLOAD_DIR / document['storage_name']
    if not path.exists():
        raise HTTPException(status_code=404, detail='Arquivo não encontrado')
    return _attachment(path, 'application/pdf', document.get('filename', 'documento.pdf'))
