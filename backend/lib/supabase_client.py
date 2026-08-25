import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

ENV_PATH = Path(__file__).resolve().parent.parent.parent / '.env'

def get_supabase() -> Client:
    load_dotenv(dotenv_path=ENV_PATH)

    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SECRET_KEY')

    if not url or not key:
        raise RuntimeError(
            'SUPABASE_URL and/or SUPABASE_SECRET_KEY not set. '
            f'Checked: {ENV_PATH}'
        )

    return create_client(url, key)