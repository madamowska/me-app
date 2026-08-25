import os 
from dotenv import load_dotenv 
from garminconnect import Garmin 
from pathlib import Path 

env_path = Path(__file__).resolve().parent.parent / '.env' 
load_dotenv(dotenv_path=env_path)

print('EMAIL:', os.getenv('GARMIN_EMAIL')) 
print('PASSWORD SET:', os.getenv('GARMIN_PASSWORD') is not None)

email = os.getenv('GARMIN_EMAIL') 
password = os.getenv('GARMIN_PASSWORD')
client = Garmin(email, password) 
client.login() 
print('Logged in as:', client.get_full_name())