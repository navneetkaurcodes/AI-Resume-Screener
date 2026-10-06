#database.py

# create_engine: connects python to postgresql
from sqlalchemy import create_engine

#sessionmaker: creates a session (temporary conversation) to connect with the database
#declarative_base: base class for all models(tables like User, Resume, JobDescription, CandidateScore, SkillGap)
from sqlalchemy.orm import sessionmaker, declarative_base

# import settings so we can read DATABASE_URL from .env
from app.core.config import settings

# actual connection between python and postgresql
#pool_pre_ping = True: checks if the connection is still alive before using it, prevents errors if the connection was closed by the database server
engine = create_engine(settings.database_url, pool_pre_ping = True)

#autocommit = False: changes are not automatically saved to the database, you have to explicitly commit them
#autoflush = False: changes are not automatically sent to the database, you have to explicitly flush them
#bind = engine: the session will use the engine we created above to connect to the database
SessionLocal = sessionmaker(autocommit = False, autoflush = False, bind = engine)

#base class for all models(tables like User, Resume, JobDescription, CandidateScore, SkillGap)
Base = declarative_base()

# Dependency function to get a database session for each request
def get_db():

    db = SessionLocal()

    try:

        yield db        # give the session to the route

    finally:

        db.close()      # always close, even if there was an error
