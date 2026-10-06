from app.core.database import Base, engine
from app.models import models  # registers all table classes with Base

Base.metadata.create_all(bind=engine)
print("Tables created successfully.")