import os
import shutil

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(ROOT_DIR, "dist")
ASSETS_DIR = os.path.join(ROOT_DIR, "app", "src", "main", "assets")
ASSETS_SUBDIR = os.path.join(ASSETS_DIR, "assets")

print(f"[TripWeave] Syncing assets from {DIST_DIR} to {ASSETS_DIR}...")

if not os.path.exists(DIST_DIR):
    raise FileNotFoundError("dist/ directory not found. Please run 'npm run build' first.")

os.makedirs(ASSETS_DIR, exist_ok=True)
if os.path.exists(ASSETS_SUBDIR):
    shutil.rmtree(ASSETS_SUBDIR)
os.makedirs(ASSETS_SUBDIR, exist_ok=True)

# Copy dist files
for item in os.listdir(DIST_DIR):
    if item.endswith(".apk"):
        continue
    src_path = os.path.join(DIST_DIR, item)
    dst_path = os.path.join(ASSETS_DIR, item)
    if os.path.isdir(src_path):
        if os.path.exists(dst_path):
            shutil.rmtree(dst_path)
        shutil.copytree(src_path, dst_path)
    else:
        shutil.copy2(src_path, dst_path)

# Remove any accidental APKs in assets
for item in os.listdir(ASSETS_DIR):
    if item.endswith(".apk"):
        os.remove(os.path.join(ASSETS_DIR, item))

print("[TripWeave] Asset synchronization complete and clean.")
