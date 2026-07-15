import os
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
from sodapy import Socrata
from sqlalchemy import create_engine
from dotenv import load_dotenv

# Step 1: Load your Supabase connection string from .env
load_dotenv()
db_url = os.getenv("SUPABASE_DB_URL")

if not db_url:
    raise ValueError("SUPABASE_DB_URL not found — check your .env file")

# Step 2: Fetch data from NYC Open Data
client = Socrata("data.cityofnewyork.us", None)
results = client.get("erm2-nwe9", limit=5000)

df = pd.DataFrame.from_records(results)
print(f"Fetched {len(df)} rows")

# Step 3: Clean the data
df = df.dropna(subset=["latitude", "longitude"])
df["latitude"] = df["latitude"].astype(float)
df["longitude"] = df["longitude"].astype(float)
print(f"After cleaning: {len(df)} rows with valid coordinates")

# Step 4: Convert to GeoDataFrame with proper geometry
geometry = [Point(xy) for xy in zip(df["longitude"], df["latitude"])]
gdf = gpd.GeoDataFrame(df, geometry=geometry, crs="EPSG:4326")

# Step 5: Upload to Supabase
engine = create_engine(db_url)
gdf.to_postgis("nyc_311_complaints", engine, if_exists="replace", index=False)

print("Upload complete! Check Supabase Table Editor to confirm.")