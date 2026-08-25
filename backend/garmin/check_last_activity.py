from garminconnect import GarminConnectAuthenticationError, GarminConnectConnectionError

from client import get_client


def check_last_activity() -> None:
    try:
        client = get_client()
    except RuntimeError as e:
        print(f'[config error] {e}')
        return
    except GarminConnectAuthenticationError:
        print('[auth error] Garmin rejected the credentials in .env.')
        return
    except GarminConnectConnectionError as e:
        print(f'[connection error] Could not reach Garmin Connect: {e}')
        return

    print(f'Logged in as: {client.get_full_name()}')

    activities = client.get_activities(0, 1)  # start=0, limit=1 → most recent

    if not activities:
        print('Connected successfully, but no activities were found on the account.')
        return

    last = activities[0]
    print('\nLast activity:')
    print(f"  Name:      {last.get('activityName')}")
    print(f"  Type:      {last.get('activityType', {}).get('typeKey')}")
    print(f"  Start:     {last.get('startTimeLocal')}")
    print(f"  Duration:  {last.get('duration')} sec")
    print(f"  Distance:  {last.get('distance')} m")
    print(f"  Calories:  {last.get('calories')}")


if __name__ == '__main__':
    check_last_activity()