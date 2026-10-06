#security.py

#datetime: used to create expiration time for the access token
#timedelta: used to create expiration time for the access token
from datetime import datetime, timedelta

#jose: used to create and verify the access token
#jwt: used to create and verify the access token
from jose import jwt

#passlib.context: used to hash and verify passwords
#CryptContext: used to hash and verify passwords
from passlib.context import CryptContext

#app.core.config: used to read settings from .env file
from app.core.config import settings

#JWTError: used to handle errors when verifying the access token
from jose import JWTError, jwt

#fastapi: used to create the API
#Depends: used to declare dependencies for the API routes
#HTTPException: used to raise HTTP exceptions
#status: used to return HTTP status codes
from fastapi import Depends, HTTPException, status

#fastapi.security: used to create the OAuth2 password flow
#OAuth2PasswordBearer: used to create the OAuth2 password flow
from fastapi.security import OAuth2PasswordBearer

#sqlalchemy.orm: used to create a session (temporary conversation) to connect with the database
from sqlalchemy.orm import Session

#app.core.database: used to get a database session for each request
#get_db: used to get a database session for each request
from app.core.database import get_db

#app.models.models: used to import the User model
from app.models.models import User

#pwd_context: used to hash and verify passwords
#CryptContext: used to hash and verify passwords
#deprecated: used to specify that the bcrypt algorithm is deprecated
pwd_context = CryptContext(schemes=["bcrypt"],deprecated="auto")

#hash_password: used to hash a password
def hash_password(password: str):

    return pwd_context.hash(password)

#verify_password: used to verify a password against a hashed password
def verify_password(plain_password: str,hashed_password: str):

    return pwd_context.verify(plain_password,hashed_password)

#create_access_token: used to create an access token
#data: dict: the data to encode in the access token
def create_access_token(data: dict):

    to_encode = data.copy()

    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode.update({"exp": expire})

    return jwt.encode(to_encode,settings.secret_key,algorithm=settings.algorithm)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

#get_current_user: used to get the current user from the access token
def get_current_user(token: str = Depends(oauth2_scheme),db: Session = Depends(get_db)):

    credentials_exception = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail="Could not validate credentials")

    try:

        payload = jwt.decode(token,settings.secret_key,algorithms=[settings.algorithm])

        user_id = payload.get("sub")

        if user_id is None:
            raise credentials_exception

        user_id = int(user_id)

    except JWTError:
        raise credentials_exception
    except (ValueError, TypeError):
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise credentials_exception

    return user

def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="Only admins can access this resource.")

    return current_user