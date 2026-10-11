import sys
import concurrent.futures
import httpx


def main():
    if len(sys.argv) < 4:
        print("Usage: python test_claim_race.py <base_url> <request_id> <vendor_id1> <vendor_id2> ...")
        sys.exit(1)

    base_url = sys.argv[1].rstrip("/")
    request_id = int(sys.argv[2])
    vendor_ids = [int(v) for v in sys.argv[3:]]

    def attempt_claim(vid):
        r = httpx.post(
            f"{base_url}/api/requests/{request_id}/claim",
            headers={"X-Demo-User-Id": str(vid)},
            timeout=15.0,
        )
        return vid, r.status_code, r.json()

    with concurrent.futures.ThreadPoolExecutor(max_workers=len(vendor_ids)) as executor:
        results = list(executor.map(attempt_claim, vendor_ids))

    successes = [v for v, code, _ in results if code == 200]
    conflicts = [v for v, code, _ in results if code == 409]

    print(f"Results: 200 Success: {successes}, 409 Conflicts: {conflicts}")
    
    if len(successes) != 1:
        print(f"❌ FAIL: Expected 1 winner, got {len(successes)}")
        sys.exit(1)
    
    if len(conflicts) != len(vendor_ids) - 1:
        print(f"❌ FAIL: Expected all others to fail with 409, got {len(conflicts)} conflicts")
        sys.exit(1)

    print("✅ PASS: Atomic claim race test succeeded!")


if __name__ == "__main__":
    main()