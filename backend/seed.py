import asyncio
from uuid import uuid5, NAMESPACE_URL

from lib.db import db, ensure_indexes
from models.players import Player


PHOTO_URLS = [
    "https://images.unsplash.com/photo-1610736342165-4eeb4aef66ca?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?auto=format&fit=crop&w=400&q=80",
]

SEED_DATA = [
    ("João Pedro Martins", "JP", "Goleiro", "15", "Ativo", 1, 178, 68),
    ("Rafael Oliveira Santos", "Rafa", "Zagueiro", "15", "Ativo", 4, 169, 61),
    ("Lucas Gabriel Costa", "Luquinhas", "Meia", "17", "Ativo", 8, 174, 66),
    ("Miguel Henrique Alves", "Mika", "Atacante", "17", "DM", 9, 176, 67),
    ("Enzo Vinícius Rocha", "Enzo", "Volante", "17", "Ativo", 5, 180, 72),
    ("Caio Augusto Ferreira", "Caio", "Zagueiro", "20", "Ativo", 3, 185, 79),
    ("Matheus Lima Rodrigues", "Math", "Lateral", "20", "Emprestado", 2, 177, 70),
    ("Pedro Henrique Souza", "PH", "Meia", "20", "Ativo", 10, 181, 73),
    ("Gustavo Araújo Mendes", "Guga", "Atacante", "Profissional", "Ativo", 11, 183, 78),
    ("André Luiz Carvalho", "André", "Goleiro", "Profissional", "Ativo", 12, 191, 86),
]


async def main() -> None:
    await ensure_indexes()
    for index, (name, nickname, position, category, status, number, height, weight) in enumerate(SEED_DATA):
        player_id = str(uuid5(NAMESPACE_URL, f"team-database:{name}"))
        player = Player(
            id=player_id,
            full_name=name,
            nickname=nickname,
            birth_date=f"{2007 - (index % 5)}-{(index % 9) + 1:02d}-{(index % 26) + 1:02d}",
            city="Valparaíso",
            school="Colégio Valparaíso",
            foot="Direito" if index % 3 else "Esquerdo",
            position=position,
            secondary_position="Ponta" if position == "Atacante" else "",
            category=category,
            status=status,
            jersey_number=number,
            height_cm=height,
            weight_kg=weight,
            body_fat=round(9.5 + index * 0.4, 1),
            shoe_size="41",
            blood_type="O+" if index % 2 else "A+",
            has_medical_restriction=status == "DM",
            medical_notes="Acompanhamento com fisiologia" if status == "DM" else "Sem restrições",
            contract_number=f"VG-{2024 + index:04d}",
            contract_start="2024-01-15",
            contract_end="2026-12-31" if category in {"15", "17"} else "2025-12-31",
            market_value="R$ 180 mil" if category == "Profissional" else "Formação",
            bid_registered=category in {"20", "Profissional"},
            guardian_name="Marcos " + nickname,
            guardian_phone="(31) 99999-0000",
            relationship="Pai",
            speed=72 + (index % 5),
            shooting=68 + (index % 8),
            passing=70 + (index % 7),
            dribbling=71 + (index % 6),
            defense=65 + (index % 10),
            physical=73 + (index % 6),
            notes="Atleta em acompanhamento de desenvolvimento técnico.",
            photo_url=PHOTO_URLS[index % len(PHOTO_URLS)],
        )
        await db.players.update_one({"id": player_id}, {"$set": player.model_dump()}, upsert=True)
    print(f"Elenco inicial pronto: {len(SEED_DATA)} jogadores")


if __name__ == "__main__":
    asyncio.run(main())