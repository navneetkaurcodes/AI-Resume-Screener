from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
import secrets
from app.core.database import get_db
from app.schemas.schemas import (UserCreate,UserResponse, UserUpdate)
from app.core.security import hash_password
from app.core.security import get_current_user
from app.core.security import get_current_admin
from app.models.models import User

router = APIRouter(prefix="/users",tags=["Users"])


@router.get("/my_profile", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/create_user",response_model=UserResponse,status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate,db: Session = Depends(get_db)):
    # Check if email already exists
    existing_user = (db.query(User).filter(User.email == user.email).first())

    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,detail="Email already registered")

    role = "hr_manager"
    if settings.admin_signup_code and secrets.compare_digest(user.admin_code or "", settings.admin_signup_code):
        role = "Admin"
    new_user = User(email=user.email,hashed_password=hash_password(user.password),full_name=user.full_name,role= role)

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

@router.get("/display_users",response_model=list[UserResponse])
def get_users(db: Session = Depends(get_db),admin: User = Depends(get_current_admin)):
    return db.query(User).all()

@router.get("/display_user/{user_id}",response_model=UserResponse)
def get_user(user_id: int,db: Session = Depends(get_db),admin: User = Depends(get_current_admin)):
    user = (db.query(User).filter(User.id == user_id).first())

    if not user:
        raise HTTPException(status_code=404,detail="User not found")

    return user

@router.put("/update_user/{user_id}", response_model=UserResponse)
def update_user(user_id: int, updated_user: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # user_id is now actually honored, and users may only edit their own account.
    if user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only update your own account.")

    update_data = updated_user.model_dump(exclude_unset=True)

    if "password" in update_data:
        current_user.hashed_password = hash_password(update_data.pop("password"))

    for key, value in update_data.items():
        setattr(current_user, key, value)

    db.commit()
    db.refresh(current_user)

    return current_user

@router.delete("/delete_user/{user_id}")
def delete_user(user_id: int,db: Session = Depends(get_db),admin: User = Depends(get_current_admin)):

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404,detail="User not found")

    db.delete(user)
    db.commit()

    return {"message": "User deleted successfully"}
