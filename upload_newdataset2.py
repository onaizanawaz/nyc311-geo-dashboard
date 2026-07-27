import os
import pandas as pd
from sqlalchemy import create_engine
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("SUPABASE_DB_URL")
if not db_url:
    raise ValueError("SUPABASE_DB_URL not found — check your .env file")

# Population by borough and decade (1950-2040), matching the "boroname"
# spelling used in the Borough Boundaries dataset (Staten Island, Brooklyn, etc)
data = {
    "Bronx": {1950: 1451277, 1960: 1424815, 1970: 1471701, 1980: 1168972, 1990: 1203789, 2000: 1332650, 2010: 1385108, 2020: 1446788, 2030: 1518998, 2040: 1579245},
    "Brooklyn": {1950: 2738175, 1960: 2627319, 1970: 2602012, 1980: 2230936, 1990: 2300664, 2000: 2465326, 2010: 2552911, 2020: 2648452, 2030: 2754009, 2040: 2840525},
    "Manhattan": {1950: 1960101, 1960: 1698281, 1970: 1539233, 1980: 1428285, 1990: 1487536, 2000: 1537195, 2010: 1585873, 2020: 1638281, 2030: 1676720, 2040: 1691617},
    "Queens": {1950: 1550849, 1960: 1809578, 1970: 1986473, 1980: 1891325, 1990: 1951598, 2000: 2229379, 2010: 2250002, 2020: 2330295, 2030: 2373551, 2040: 2412649},
    "Staten Island": {1950: 191555, 1960: 221991, 1970: 295443, 1980: 352121, 1990: 378977, 2000: 443728, 2010: 468730, 2020: 487155, 2030: 497749, 2040: 501109},
}

rows = []
for borough, years in data.items():
    for year, population in years.items():
        rows.append({"boroname": borough, "year": year, "population": population})

df = pd.DataFrame(rows)
print(df.head())
print(f"Total rows: {len(df)}")

engine = create_engine(db_url)
df.to_sql("borough_population", engine, if_exists="replace", index=False)
print("Population data uploaded to Supabase!")
print("Table: borough_population | key column: boroname")