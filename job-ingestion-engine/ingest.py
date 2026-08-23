import os
import re
import hashlib
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
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

def clean_html_description(raw_html: str) -> str:
    """Strips HTML tags, scripts, styles, and normalizes whitespace."""
    if not raw_html:
        return ""
    try:
        soup = BeautifulSoup(raw_html, "html.parser")
        for element in soup(["script", "style", "header", "footer", "nav"]):
            element.decompose()
        text = soup.get_text(separator=" ", strip=True)
        return re.sub(r'\s+', ' ', text).strip()
    except Exception:
        return re.sub(r'<[^>]*>?', ' ', str(raw_html)).strip()

def get_company_logo_fallback(company_name: str, direct_logo: str = "", slug: str = "") -> str:
    """
    Robust logo resolver that checks direct URLs first and then falls back 
    to Google Favicon API and Unavatar services instead of deprecated Clearbit.
    """
    if direct_logo and str(direct_logo).startswith(('http://', 'https://')):
        return direct_logo.strip()

    # Clean company identifier for domain fallback
    clean_identifier = (slug or company_name).lower().strip()
    clean_identifier = re.sub(r'[^a-z0-9]', '', clean_identifier)

    if not clean_identifier:
        return ""

    # Primary Fallback: Google Favicon Service (128px high-res)
    domain_guess = f"{clean_identifier}.com"
    return f"https://www.google.com/s2/favicons?domain={domain_guess}&sz=128"

# --- LAYER 1: OPEN GLOBAL FEEDS ---

def fetch_remoteok_jobs():
    """Fetches global remote roles from RemoteOK JSON API."""
    url = "https://remoteok.com/api"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    try:
        res = requests.get(url, headers=headers, timeout=12)
        if res.status_code != 200:
            print(f"[RemoteOK] Failed fetch: Status {res.status_code}")
            return []

        jobs = []
        data = res.json()[1:]  # Skip metadata header
        for item in data[:100]:
            company = item.get('company', 'Unknown')
            title = item.get('position', '')
            if not title:
                continue

            raw_desc = item.get('description', '')
            clean_desc = clean_html_description(raw_desc)
            
            # Extract raw logo or resolve dynamic fallback
            raw_logo = item.get('company_logo', '') or item.get('logo', '')
            logo_url = get_company_logo_fallback(company, direct_logo=raw_logo)

            jobs.append((
                generate_dedup_hash(title, company),
                title,
                company,
                'Remote',
                'General',
                'Full-Time',
                clean_desc,
                item.get('url', ''),
                logo_url,
                'feed',
                'remoteok',
                item.get('date', datetime.now(timezone.utc).isoformat())
            ))
        return jobs
    except Exception as e:
        print(f"[RemoteOK] Error fetching feed: {e}")
        return []

def fetch_weworkremotely_jobs():
    """Fetches global listings from WeWorkRemotely RSS Feed."""
    url = "https://weworkremotely.com/remote-jobs.rss"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    try:
        res = requests.get(url, headers=headers, timeout=12)
        if res.status_code != 200:
            print(f"[WWR] Failed fetch: Status {res.status_code}")
            return []

        root = ET.fromstring(res.content)
        jobs = []

        for item in root.findall('./channel/item'):
            raw_title = item.findtext('title', '')
            link = item.findtext('link', '')
            pub_date = item.findtext('pubDate', datetime.now(timezone.utc).isoformat())
            raw_desc = item.findtext('description', '')

            # WWR Titles are formatted as "Company Name: Job Title"
            if ":" in raw_title:
                company, title = raw_title.split(":", 1)
            else:
                company, title = "We Work Remotely", raw_title

            company = company.strip()
            title = title.strip()
            if not title:
                continue

            clean_desc = clean_html_description(raw_desc)

            # Extract image inside RSS description tag if present
            raw_logo = ''
            if raw_desc:
                soup = BeautifulSoup(raw_desc, 'html.parser')
                img_tag = soup.find('img')
                if img_tag and img_tag.get('src'):
                    raw_logo = img_tag['src']

            logo_url = get_company_logo_fallback(company, direct_logo=raw_logo)

            jobs.append((
                generate_dedup_hash(title, company),
                title,
                company,
                'Remote',
                'General',
                'Full-Time',
                clean_desc,
                link,
                logo_url,
                'feed',
                'weworkremotely',
                pub_date
            ))
        return jobs
    except Exception as e:
        print(f"[WWR] Error fetching RSS feed: {e}")
        return []

# --- LAYER 2: DYNAMIC ATS ENGINE ---

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
        
        # Greenhouse provides company logo under board metadata
        raw_logo = data.get('logo_url', '')
        logo_url = get_company_logo_fallback(company_name, direct_logo=raw_logo, slug=slug)

        for item in data.get('jobs', []):
            title = item.get('title', '')
            if not title:
                continue

            clean_desc = clean_html_description(item.get('content', ''))

            jobs.append((
                generate_dedup_hash(title, company_name),
                title,
                company_name,
                item.get('location', {}).get('name', 'Remote'),
                'General',
                'Full-Time',
                clean_desc,
                item.get('absolute_url', ''),
                logo_url,
                'ats',
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
                return []
        if res.status_code != 200:
            print(f"[Lever] Failed {slug}: Status {res.status_code}")
            return []

        jobs = []
        logo_url = get_company_logo_fallback(company_name, slug=slug)

        for item in res.json():
            title = item.get('text', '')
            if not title:
                continue

            created_at = datetime.fromtimestamp(item['createdAt'] / 1000, tz=timezone.utc).isoformat() if 'createdAt' in item else datetime.now(timezone.utc).isoformat()
            clean_desc = clean_html_description(item.get('descriptionPlain', '') or item.get('description', ''))

            jobs.append((
                generate_dedup_hash(title, company_name),
                title,
                company_name,
                item.get('categories', {}).get('location', 'Remote'),
                'General',
                'Full-Time',
                clean_desc,
                item.get('hostedUrl', ''),
                logo_url,
                'ats',
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
        raw_logo = data.get('organizationLogoUrl', '')
        logo_url = get_company_logo_fallback(company_name, direct_logo=raw_logo, slug=slug)

        for item in data.get('jobs', []):
            title = item.get('title', '')
            if not title:
                continue

            clean_desc = clean_html_description(item.get('descriptionHtml', ''))

            jobs.append((
                generate_dedup_hash(title, company_name),
                title,
                company_name,
                item.get('location', 'Remote'),
                'General',
                'Full-Time',
                clean_desc,
                item.get('jobUrl', ''),
                logo_url,
                'ats',
                'ashby',
                item.get('publishedAt', datetime.now(timezone.utc).isoformat())
            ))
        return jobs
    except Exception as e:
        print(f"[Ashby] Error fetching {slug}: {e}")
        return []

# --- LAYER 3: AUTOMATED ATS DISCOVERY ---

def auto_discover_company_ats(company_name: str, domain: str, cursor, conn):
    """Sniffs a company website to detect which ATS platform they use and registers it in target_companies."""
    clean_domain = domain.replace("https://", "").replace("http://", "").strip("/")
    url = f"https://{clean_domain}/careers"
    headers = {'User-Agent': 'Mozilla/5.0'}

    try:
        res = requests.get(url, headers=headers, timeout=8, allow_redirects=True)
        html = res.text.lower()

        detected_ats = None
        slug = company_name.lower().replace(" ", "")

        if "boards.greenhouse.io" in html or "greenhouse.io" in html:
            detected_ats = "greenhouse"
        elif "lever.co" in html or "jobs.lever.co" in html:
            detected_ats = "lever"
        elif "ashbyhq.com" in html:
            detected_ats = "ashby"

        if detected_ats:
            cursor.execute("""
                INSERT INTO target_companies (name, ats_type, ats_slug, is_active)
                VALUES (%s, %s, %s, TRUE)
                ON CONFLICT (ats_slug) DO UPDATE SET is_active = TRUE;
            """, (company_name, detected_ats, slug))
            conn.commit()
            print(f"[Discovery] Detected {detected_ats.upper()} for {company_name} ({slug}). Added to targets.")
            return detected_ats, slug
    except Exception as e:
        print(f"[Discovery] Could not sniff ATS for {company_name}: {e}")

    return None, None

# --- DEDUPLICATION HELPER ---

def deduplicate_jobs(jobs_list):
    """Filters out duplicate hashes within the current batch payload."""
    unique_jobs = {}
    for job in jobs_list:
        dedup_hash = job[0]
        unique_jobs[dedup_hash] = job
    return list(unique_jobs.values())

# --- DATABASE UPSERT & PIPELINE EXECUTOR ---

def run_pipeline():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SET search_path TO public;")

        # 1. Fetch active target companies from Postgres
        cursor.execute("SELECT name, ats_type, ats_slug FROM target_companies WHERE is_active = TRUE;")
        targets = cursor.fetchall()

        all_jobs = []

        # 2. Layer 2: Extract ATS jobs dynamically
        for name, ats_type, slug in targets:
            print(f"Fetching jobs for {name} ({ats_type})...")
            if ats_type == 'greenhouse':
                all_jobs.extend(fetch_greenhouse_jobs(name, slug))
            elif ats_type == 'lever':
                all_jobs.extend(fetch_lever_jobs(name, slug))
            elif ats_type == 'ashby':
                all_jobs.extend(fetch_ashby_jobs(name, slug))

        # 3. Layer 1: Extract Global Feeds (RemoteOK + WeWorkRemotely)
        print("Fetching jobs from RemoteOK feed...")
        all_jobs.extend(fetch_remoteok_jobs())

        print("Fetching jobs from We Work Remotely RSS feed...")
        all_jobs.extend(fetch_weworkremotely_jobs())

        print(f"Total extracted raw listings: {len(all_jobs)}")

        # 4. Filter batch-level duplicate hashes
        clean_jobs = deduplicate_jobs(all_jobs)
        print(f"Total unique listings to upsert: {len(clean_jobs)}")

        # 5. Perform Atomic Batch Upsert into Postgres (Overwriting old logo_url entries)
        upsert_query = """
            INSERT INTO job_listings (
                dedup_hash, title, company_name, location, category, 
                employment_type, description, apply_url, logo_url, source_type, 
                source_provider, posted_at
            ) VALUES %s
            ON CONFLICT (dedup_hash) DO UPDATE SET
                title = EXCLUDED.title,
                location = EXCLUDED.location,
                description = EXCLUDED.description,
                apply_url = EXCLUDED.apply_url,
                logo_url = EXCLUDED.logo_url,
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