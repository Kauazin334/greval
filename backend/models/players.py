from datetime import date, datetime, timezone
import re
import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator


CPF_FIELDS = set()  # CPF validation disabled: accept entered values as-is
PHONE_FIELDS = {'father_phone', 'mother_phone', 'guardian_phone'}
DATE_FIELDS = {'birth_date', 'publication_date', 'contract_start', 'contract_end', 'termination_date'}


class PlayerBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='ignore')

    full_name: str = Field(min_length=2, max_length=120)
    nickname: str = Field(default='', max_length=80)
    birth_date: str = Field(default='', max_length=10)
    cpf: str = Field(default='', max_length=14)
    city: str = Field(default='', max_length=100)
    club_name: str = Field(default='', max_length=120)
    club_state: str = Field(default='', max_length=2)
    address: str = Field(default='', max_length=300)
    father_name: str = Field(default='', max_length=120)
    father_cpf: str = Field(default='', max_length=14)
    father_phone: str = Field(default='', max_length=20)
    mother_name: str = Field(default='', max_length=120)
    mother_cpf: str = Field(default='', max_length=14)
    mother_phone: str = Field(default='', max_length=20)
    school: str = Field(default='', max_length=160)
    school_grade: str = Field(default='', max_length=80)
    foot: str = Field(default='Direito', max_length=20)
    position: str = Field(default='', max_length=50)
    secondary_position: str = Field(default='', max_length=50)
    category: str = Field(default='17', max_length=20)
    jersey_number: int | None = Field(default=None, ge=0, le=99)
    status: str = Field(default='Ativo', max_length=30)
    height_cm: float | None = Field(default=None, ge=30, le=280)
    weight_kg: float | None = Field(default=None, ge=1, le=300)
    body_fat: float | None = Field(default=None, ge=0, le=100)
    wingspan_cm: float | None = Field(default=None, ge=30, le=300)
    shoe_size: str = Field(default='', max_length=12)
    blood_type: str = Field(default='', max_length=5)
    allergies: str = Field(default='', max_length=1000)
    medical_notes: str = Field(default='', max_length=4000)
    has_medical_restriction: bool = False
    contract_number: str = Field(default='', max_length=80)
    cbf_number: str = Field(default='', max_length=80)
    bid_number: str = Field(default='', max_length=80)
    publication_date: str = Field(default='', max_length=10)
    contract_start: str = Field(default='', max_length=10)
    contract_end: str = Field(default='', max_length=10)
    contract_status: str = Field(default='Vigente', max_length=40)
    termination_date: str = Field(default='', max_length=10)
    termination_reason: str = Field(default='', max_length=500)
    market_value: str = Field(default='', max_length=60)
    release_clause: str = Field(default='', max_length=80)
    bid_registered: bool = False
    guardian_name: str = Field(default='', max_length=120)
    guardian_phone: str = Field(default='', max_length=20)
    guardian_cpf: str = Field(default='', max_length=14)
    guardian_email: str = Field(default='', max_length=254)
    relationship: str = Field(default='', max_length=50)
    speed: int = Field(default=70, ge=0, le=99)
    shooting: int = Field(default=70, ge=0, le=99)
    passing: int = Field(default=70, ge=0, le=99)
    dribbling: int = Field(default=70, ge=0, le=99)
    defense: int = Field(default=70, ge=0, le=99)
    physical: int = Field(default=70, ge=0, le=99)
    notes: str = Field(default='', max_length=4000)
    history: str = Field(default='', max_length=10000)

    @field_validator('*')
    @classmethod
    def validate_sensitive_values(cls, value, info):
        if not isinstance(value, str) or not value:
            return value
        if info.field_name in DATE_FIELDS:
            try:
                date.fromisoformat(value)
            except ValueError as exc:
                raise ValueError('Use data ISO AAAA-MM-DD') from exc
        if info.field_name in CPF_FIELDS:
            digits = re.sub(r'\D', '', value)
            if len(digits) != 11 or len(set(digits)) == 1:
                raise ValueError('CPF inválido')
            total = sum(int(digits[i]) * (10 - i) for i in range(9))
            first = (total * 10 % 11) % 10
            total = sum(int(digits[i]) * (11 - i) for i in range(10))
            second = (total * 10 % 11) % 10
            if digits[-2:] != f'{first}{second}':
                raise ValueError('CPF inválido')
        if info.field_name in PHONE_FIELDS and not re.fullmatch(r'\D*(?:\d\D*){10,11}', value):
            raise ValueError('Telefone inválido')
        return value


class PlayerCreate(PlayerBase):
    pass


class PlayerDocument(BaseModel):
    document_type: str
    label: str
    filename: str
    size_bytes: int
    uploaded_at: str


class DocumentUploadResponse(PlayerDocument):
    pass


class PhotoUploadResponse(BaseModel):
    photo_url: str
    filename: str
    size_bytes: int


class DvdUploadResponse(BaseModel):
    dvd_url: str
    filename: str
    size_bytes: int
    uploaded_at: str


class Player(PlayerBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    photo_url: str = ''
    dvd_url: str = ''
    dvd_filename: str = ''
    dvd_uploaded_at: str = ''
    documents: list[PlayerDocument] = Field(default_factory=list)


class PlayerPage(BaseModel):
    items: list[Player]
    total: int
    limit: int
    offset: int
