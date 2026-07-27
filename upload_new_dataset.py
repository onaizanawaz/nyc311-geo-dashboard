import os
import geopandas as gpd
from sqlalchemy import create_engine
from dotenv import load_dotenv

# Step 1: Load your Supabase connection string from .env
load_dotenv()
db_url = os.getenv("SUPABASE_DB_URL")
if not db_url:
    raise ValueError("SUPABASE_DB_URL not found — check your .env file")

# Step 2: Load the downloaded Borough Boundaries GeoJSON
# Update this path if your file is named/located differently
gdf = gpd.read_file("Borough_Boundaries_20260720.geojson")
print(f"Loaded {len(gdf)} boroughs")
print(f"Columns: {gdf.columns.tolist()}")

# Step 3: Keep only the columns we actually need, and make sure CRS is
# WGS84 (EPSG:4326) so it lines up with the complaints table (lat/lng points)
gdf = gdf[["borocode", "boroname", "shape_area", "shape_leng", "geometry"]]
gdf = gdf.to_crs(epsg=4326)

# Step 4: Upload to Supabase as a new PostGIS table
engine = create_engine(db_url)
gdf.to_postgis("borough_boundaries", engine, if_exists="replace", index=False)
print("Borough boundaries uploaded to Supabase!")
print("Table: borough_boundaries | key column: boroname")