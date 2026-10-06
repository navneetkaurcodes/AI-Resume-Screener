#config.py

# import BaseSettings from pydantic_settings to read environment variables from .env file
from pydantic_settings import BaseSettings

# create a Settings class that inherits from BaseSettings to read environment variables from .env file
class Settings(BaseSettings):
    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    upload_dir: str = "./uploads"
    admin_signup_code: str = ""
    gemini_api_key: str = ""
    cors_origins: str = "http://localhost:5500"

    # create a Config class to specify the .env file location
    class Config:
        env_file = ".env"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

settings = Settings()