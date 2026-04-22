"""
Seed de desenvolvimento.
Uso: cd backend && python seed.py
"""
import asyncio
import uuid

from passlib.context import CryptContext
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.contract import Contract
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ADMIN_EMAIL = "admin@docextract.com"
ADMIN_PASSWORD = "admin123"

CESAN_FIELDS = {
    "Holerite": "",
    "FGTS": "",
    "Vale Transporte": "",
    "Ponto / Frequência": "",
    "ASO": "",
    "Férias": "",
    "13º Salário": "",
    "Rescisão": "",
}


async def main():
    async with AsyncSessionLocal() as session:
        existing = (await session.execute(select(User).where(User.email == ADMIN_EMAIL))).scalar_one_or_none()

        if existing:
            print(f"Usuário {ADMIN_EMAIL} já existe — pulando.")
            user = existing
        else:
            user = User(
                id=uuid.uuid4(),
                email=ADMIN_EMAIL,
                name="Admin DocExtract",
                hashed_password=pwd_context.hash(ADMIN_PASSWORD),
                plan="admin",
            )
            session.add(user)
            await session.flush()
            print(f"Usuário criado: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")

        contrato_exists = (
            await session.execute(select(Contract).where(Contract.user_id == user.id, Contract.name == "Contrato CESAN Padrão"))
        ).scalar_one_or_none()

        if not contrato_exists:
            contrato = Contract(
                id=uuid.uuid4(),
                user_id=user.id,
                name="Contrato CESAN Padrão",
                client="CESAN — Companhia Espírito Santense de Saneamento",
                edital="PE 001/2024",
                fields_template=CESAN_FIELDS,
            )
            session.add(contrato)
            print("Contrato CESAN padrão criado.")
        else:
            print("Contrato CESAN já existe — pulando.")

        await session.commit()
        print("Seed concluído.")


if __name__ == "__main__":
    asyncio.run(main())
