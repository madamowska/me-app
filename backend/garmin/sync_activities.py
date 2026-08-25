import argparse
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from dotenv import load_dotenv

from garminconnect import GarminConnectAuthenticationError, GarminConnectConnectionError

from backend.garmin.client import get_client
from backend.lib.supabase_client import get_supabase

BATCH_SIZE = 200
ENV_PATH = Path(__file__).resolve().parent.parent.parent / '.env'

def _safe_int(value):
    return int(value) if value is not None else None


def _to_record(activity: dict, profile_id: str) -> dict:
    return {
        'profile_id': profile_id,
        'garmin_activity_id': activity.get('activityId'),
        'activity_type': (activity.get('activityType') or {}).get('typeKey'),
        'activity_name': activity.get('activityName'),
        'start_time': activity.get('startTimeGMT'),
        'duration_seconds': _safe_int(activity.get('duration')),
        'distance_m': activity.get('distance'),
        'calories': activity.get('calories'),
        'avg_heart_rate': _safe_int(activity.get('averageHR')),
        'max_heart_rate': _safe_int(activity.get('maxHR')),
        'avg_speed_mps': activity.get('averageSpeed'),
        'max_speed_mps': activity.get('maxSpeed'),
        'raw_data': activity,
    }


def _chunks(items, size):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def sync_activities(days: int = 365) -> None:
    load_dotenv(dotenv_path=ENV_PATH)
    profile_id = os.getenv('GARMIN_PROFILE_ID')
    if not profile_id:
        print('[config error] GARMIN_PROFILE_ID not set in .env.')
        return

    try:
        garmin = get_client()
    except RuntimeError as e:
        print(f'[config error] {e}')
        return
    except GarminConnectAuthenticationError:
        print('[auth error] Garmin rejected the credentials in .env.')
        return
    except GarminConnectConnectionError as e:
        print(f'[connection error] Could not reach Garmin Connect: {e}')
        return

    supabase = get_supabase()

    end_date = date.today()
    start_date = end_date - timedelta(days=days)
    print(f'Fetching activities from {start_date} to {end_date}...')

    try:
        activities = garmin.get_activities_by_date(
            start_date.isoformat(), end_date.isoformat()
        )
    except GarminConnectConnectionError as e:
        print(f'[connection error] Failed while fetching activities: {e}')
        return

    if not activities:
        print('No activities found in range.')
        return

    print(f'Fetched {len(activities)} activities. Upserting...')

    records = [_to_record(a, profile_id) for a in activities]
    upserted = 0

    for batch in _chunks(records, BATCH_SIZE):
        try:
            result = (
                supabase.table('activities')
                .upsert(batch, on_conflict='profile_id,garmin_activity_id')
                .execute()
            )
            upserted += len(result.data or [])
            print(f'  upserted batch of {len(batch)}')
        except Exception as e:
            print(f'[db error] Batch failed, skipping: {e}')

    supabase.table('garmin_sync_state').upsert(
        {
            'source': 'garmin',
            'last_synced_at': datetime.now(timezone.utc).isoformat(),
        },
        on_conflict='source',
    ).execute()

    print(f'Done. {upserted} rows upserted across {len(records)} fetched activities.')


if __name__ == '__main__':
    import json

    parser = argparse.ArgumentParser(description='Sync Garmin activities into Supabase.')
    parser.add_argument(
        '--days', type=int, default=None,
        help='Force a specific lookback window. Omit for incremental sync since last run.'
    )
    args = parser.parse_args()
    result = sync_activities(days=args.days)
    print(f'SYNC_RESULT_JSON:{json.dumps(result)}')