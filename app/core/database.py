# imports
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# import settings so we can read DATABASE_URL from .env
from app.core.config import settings

# connect python to postgresql
# every time a route needs to read or write data, it gets a "session" from here

# the engine is the actual connection to postgresql
# pool_pre_ping = True means: test the connection before using it
# this prevents errors if postgresql briefly went offline
engine = create_engine(settings.database_url, pool_pre_ping = True)



# autocommit = False means: don't save changes until we explicitly call db.commit()
# autoflush  = False means: don't send queries to DB until we explicitly ask
SessionLocal = sessionmaker(autocommit = False, autoflush = False, bind = engine)

Base = declarative_base()



# FastAPI calls it automatically when a route has: db = Depends(get_db)
# it gives the route a fresh session, then closes it when the route finishes
# the "finally" block runs even if an error happens — so the session always closes
def get_db():

    db = SessionLocal()

    try:

        yield db        # give the session to the route

    finally:

        db.close()      # always close, even if there was an error
