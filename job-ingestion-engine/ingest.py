import os
import hashlib
import requests
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    """Establish SSL connection to Render Postgres."""
    return psycopg2.connect(DATABASE_URL)

def generate_dedup_hash(title: str, company: str) -> str:
    """Creates a deterministic unique SHA-256 hash for deduplication."""
    raw = f"{title.strip().lower()}:{company.strip().lower()}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()

# --- 1. ATS FETCHERS ---

def fetch_greenhouse_jobs(company_name: str, slug: str):
    url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"
    try:
        res = requests.get(url, timeout=10)
        if res.status_code == 404:
            print(f"[Greenhouse] {company_name} ({slug}) returned 404. Checking Lever fallback...")
            return fetch_lever_jobs(company_name, slug, is_fallback=True)
        if res.status_code != 200:
            print(f"[Greenhouse] Failed {slug}: Status {res.status_code}")
            return []
        
        jobs = []
        data = res.json()
        for item in data.get('jobs', []):
            jobs.append((
                generate_dedup_hash(item['title'], company_name),
                item['title'],
                company_name,
                item.get('location', {}).get('name', 'Remote'),
                'General',
                'Full-Time',
                item.get('content', ''),
                item['absolute_url'],
                'ats_direct',
                'greenhouse',
                item.get('updated_at', datetime.now(timezone.utc).isoformat())
            ))
        return jobs
    except Exception as e:
        print(f"[Greenhouse] Error fetching {slug}: {e}")
        return []

def fetch_lever_jobs(company_name: str, slug: str, is_fallback: bool = False):
    url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
    try:
        res = requests.get(url, timeout=10)
        if res.status_code == 404:
            if not is_fallback:
                print(f"[Lever] {company_name} ({slug}) returned 404. Checking Greenhouse fallback...")
                return fetch_greenhouse_jobs(company_name, slug)
            else:
                print(f"[Lever] Fallback failed for {company_name} ({slug}): Status 404")
                return []
        if res.status_code != 200:
            print(f"[Lever] Failed {slug}: Status {res.status_code}")
            return []
        
        jobs = []
        for item in res.json():
            title = item.get('text', '')
            if not title:
                continue
            created_at = datetime.fromtimestamp(item['createdAt'] / 1000, tz=timezone.utc).isoformat() if 'createdAt' in item else datetime.now(timezone.utc).isoformat()
            
            jobs.append((
                generate_dedup_hash(title, company_name),
                title,
                company_name,
                item.get('categories', {}).get('location', 'Remote'),
                'General',
                'Full-Time',
                item.get('descriptionPlain', ''),
                item.get('hostedUrl', ''),
                'ats_direct',
                'lever',
                created_at
            ))
        return jobs
    except Exception as e:
        print(f"[Lever] Error fetching {slug}: {e}")
        return []

def fetch_ashby_jobs(company_name: str, slug: str):
    url = f"https://api.ashbyhq.com/posting-api/job-board/{slug}"
    try:
        res = requests.get(url, timeout=10)
        if res.status_code != 200:
            print(f"[Ashby] Failed {slug}: Status {res.status_code}")
            return []
        
        jobs = []
        data = res.json()
        for item in data.get('jobs', []):
            title = item.get('title', '')
            if not title:
                continue
            
            jobs.append((
                generate_dedup_hash(title, company_name),
                title,
                company_name,
                item.get('location', 'Remote'),
                'General',
                'Full-Time',
                item.get('descriptionHtml', ''),
                item.get('jobUrl', ''),
                'ats_direct',
                'ashby',
                item.get('publishedAt', datetime.now(timezone.utc).isoformat())
            ))
        return jobs
    except Exception as e:
        print(f"[Ashby] Error fetching {slug}: {e}")
        return []

# --- 2. PUBLIC JSON FEED FETCHER ---

def fetch_remoteok_jobs():
    url = "https://remoteok.com/api"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    try:
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code != 200:
            print(f"[RemoteOK] Failed fetch: Status {res.status_code}")
            return []
        
        jobs = []
        data = res.json()[1:]  # Skip platform metadata header
        for item in data[:50]:  # Process recent jobs
            company = item.get('company', 'Unknown')
            title = item.get('position', '')
            if not title:
                continue
            
            jobs.append((
                generate_dedup_hash(title, company),
                title,
                company,
                'Remote',
                'General',
                'Full-Time',
                item.get('description', ''),
                item.get('url', ''),
                'json_feed',
                'remoteok',
                item.get('date', datetime.now(timezone.utc).isoformat())
            ))
        return jobs
    except Exception as e:
        print(f"[RemoteOK] Error fetching feed: {e}")
        return []

# --- 3. DEDUPLICATION HELPER ---

def deduplicate_jobs(jobs_list):
    """Filters out duplicate hashes within the current batch payload."""
    unique_jobs = {}
    for job in jobs_list:
        dedup_hash = job[0]
        unique_jobs[dedup_hash] = job
    return list(unique_jobs.values())

# --- 4. DATABASE UPSERT & PIPELINE EXECUTOR ---

def run_pipeline():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Ensure public schema search path
        cursor.execute("SET search_path TO public;")
        
        # 1. Fetch active target companies from Postgres
        cursor.execute("SELECT name, ats_type, ats_slug FROM target_companies WHERE is_active = TRUE;")
        targets = cursor.fetchall()
        
        all_jobs = []
        
        # 2. Extract ATS jobs dynamically
        for name, ats_type, slug in targets:
            print(f"Fetching jobs for {name} ({ats_type})...")
            if ats_type == 'greenhouse':
                all_jobs.extend(fetch_greenhouse_jobs(name, slug))
            elif ats_type == 'lever':
                all_jobs.extend(fetch_lever_jobs(name, slug))
            elif ats_type == 'ashby':
                all_jobs.extend(fetch_ashby_jobs(name, slug))
        
        # 3. Extract JSON feed jobs
        print("Fetching jobs from RemoteOK feed...")
        all_jobs.extend(fetch_remoteok_jobs())
        
        print(f"Total extracted raw listings: {len(all_jobs)}")
        
        # 4. Filter batch-level duplicate hashes
        clean_jobs = deduplicate_jobs(all_jobs)
        print(f"Total unique listings to upsert: {len(clean_jobs)}")
        
        # 5. Perform Atomic Batch Upsert into Postgres
        upsert_query = """
            INSERT INTO job_listings (
                dedup_hash, title, company_name, location, category, 
                employment_type, description, apply_url, source_type, 
                source_provider, posted_at
            ) VALUES %s
            ON CONFLICT (dedup_hash) DO UPDATE SET
                title = EXCLUDED.title,
                location = EXCLUDED.location,
                description = EXCLUDED.description,
                apply_url = EXCLUDED.apply_url,
                updated_at = NOW();
        """
        
        if clean_jobs:
            execute_values(cursor, upsert_query, clean_jobs)
            conn.commit()
            print(f"Successfully upserted {len(clean_jobs)} records into Postgres!")
        else:
            print("No new jobs to process.")
            
        cursor.close()
    except Exception as e:
        print(f"Pipeline execution error: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    run_pipeline()