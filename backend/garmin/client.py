import os
from pathlib import Path
from dotenv import load_dotenv
from garminconnect import Garmin, GarminConnectAuthenticationError, GarminConnectConnectionError

ENV_PATH = Path(__file__).resolve().parent.parent.parent / '.env'


def get_client() -> Garmin:
    load_dotenv(dotenv_path=ENV_PATH)

    email = os.getenv('GARMIN_EMAIL')
    password = os.getenv('GARMIN_PASSWORD')

    if not email or not password:
        raise RuntimeError(
            'GARMIN_EMAIL and/or GARMIN_PASSWORD not set. '
            f'Checked: {ENV_PATH}'
        )

    client = Garmin(email, password)
    client.login()
    return client