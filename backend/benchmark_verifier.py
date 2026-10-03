import time
from job_dashboard.verifier import verify_job_urls

def run_benchmark():
    # Mix of valid, invalid, and slow URLs
    urls = [
        "https://www.google.com",
        "https://www.github.com",
        "https://www.python.org",
        "https://invalid.domain.example.nonexistent/job/1",
        "https://invalid.domain.example.nonexistent/job/2",
        "https://invalid.domain.example.nonexistent/job/3",
        "https://httpbin.org/delay/2",
        "https://httpbin.org/delay/2",
        "https://httpbin.org/delay/2",
        "https://httpbin.org/status/404"
    ]

    start = time.time()
    results = verify_job_urls(urls, force=True)
    end = time.time()

    print(f"Verified {len(results)} URLs in {end - start:.2f} seconds")

if __name__ == "__main__":
    run_benchmark()
