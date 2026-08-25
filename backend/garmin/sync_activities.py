import argparse
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from garminconnect import GarminConnectAuthenticationError, GarminConnectConnectionError

from backend.garmin.client import get_client
from backend.lib.supabase_client import get_supabase

BATCH_SIZE = 200
SYNC_SOURCE = 'garmin'
FIRST_RUN_LOOKBACK_DAYS = 365
OVERLAP_DAYS = 1
ENV_PATH = Path(__file__).resolve().parent.parent.parent / '.env'


def _safe_int(value):
    return int(value) if value is not None else None


def _to_record(activity: dict, profile_id: str) -> dict:
    """Map a garminconnect activity dict to a public.activities row."""
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


def _get_last_synced_at(supabase) -> datetime | None:
    result = (
        supabase.table('garmin_sync_state')
        .select('last_synced_at')
        .eq('source', SYNC_SOURCE)
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    return datetime.fromisoformat(result.data[0]['last_synced_at'])


def _resolve_start_date(supabase, days_override: int | None) -> date:
    if days_override is not None:
        return date.today() - timedelta(days=days_override)

    last_synced_at = _get_last_synced_at(supabase)
    if last_synced_at is None:
        print(f'No previous sync found — defaulting to {FIRST_RUN_LOOKBACK_DAYS} days back.')
        return date.today() - timedelta(days=FIRST_RUN_LOOKBACK_DAYS)

    return last_synced_at.date() - timedelta(days=OVERLAP_DAYS)


def sync_activities(days: int | None = None) -> dict:
    """Returns a summary dict — useful both for CLI printing and for an API caller."""
    load_dotenv(dotenv_path=ENV_PATH)

    profile_id = os.getenv('GARMIN_PROFILE_ID')
    if not profile_id:
        msg = f'GARMIN_PROFILE_ID not set. Checked: {ENV_PATH}'
        print(f'[config error] {msg}')
        return {'success': False, 'error': msg}

    try:
        garmin = get_client()
    except RuntimeError as e:
        print(f'[config error] {e}')
        return {'success': False, 'error': str(e)}
    except GarminConnectAuthenticationError:
        msg = 'Garmin rejected the credentials in .env.'
        print(f'[auth error] {msg}')
        return {'success': False, 'error': msg}
    except GarminConnectConnectionError as e:
        msg = f'Could not reach Garmin Connect: {e}'
        print(f'[connection error] {msg}')
        return {'success': False, 'error': msg}

    supabase = get_supabase()

    start_date = _resolve_start_date(supabase, days)
    end_date = date.today()
    print(f'Fetching activities from {start_date} to {end_date}...')

    try:
        activities = garmin.get_activities_by_date(
            start_date.isoformat(), end_date.isoformat()
        )
    except GarminConnectConnectionError as e:
        msg = f'Failed while fetching activities: {e}'
        print(f'[connection error] {msg}')
        return {'success': False, 'error': msg}

    if not activities:
        print('No new activities found.')
        _update_sync_state(supabase)
        return {'success': True, 'fetched': 0, 'upserted': 0}

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

    _update_sync_state(supabase)

    print(f'Done. {upserted} rows upserted across {len(records)} fetched activities.')
    return {'success': True, 'fetched': len(records), 'upserted': upserted}


def _update_sync_state(supabase) -> None:
    supabase.table('garmin_sync_state').upsert(
        {
            'source': SYNC_SOURCE,
            'last_synced_at': datetime.now(timezone.utc).isoformat(),
        },
        on_conflict='source',
    ).execute()


if __name__ == '__main__':
    import json
    import sys

    parser = argparse.ArgumentParser(description='Sync Garmin activities into Supabase.')
    parser.add_argument(
        '--days', type=int, default=None,
        help='Force a specific lookback window. Omit for incremental sync since last run.'
    )
    args = parser.parse_args()

    try:
        result = sync_activities(days=args.days)
    except Exception as e:
        print(f'[unexpected error] {e}', file=sys.stderr)
        result = {'success': False, 'error': str(e)}

    print(f'SYNC_RESULT_JSON:{json.dumps(result)}', flush=True)