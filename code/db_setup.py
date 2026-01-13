"""
Database Setup Script for Tanker Delivery System
Connects to Supabase PostgreSQL and executes SQL schema files
"""

import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env file
load_dotenv()


def get_db_connection():
    """Create and return a database connection using the connection string"""
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise ValueError("DATABASE_URL not found in .env file")

    print("Connecting to Supabase database...")
    conn = psycopg2.connect(database_url)
    print("✓ Connected successfully!")
    return conn


def execute_sql_file(conn, sql_file_path):
    """Execute SQL commands from a file"""
    print(f"\nExecuting SQL file: {sql_file_path}")

    # Read the SQL file
    with open(sql_file_path, "r", encoding="utf-8") as file:
        sql_content = file.read()

    # Execute the SQL
    cursor = conn.cursor()
    try:
        cursor.execute(sql_content)
        conn.commit()
        print(f"✓ Successfully executed {sql_file_path}")
    except Exception as e:
        conn.rollback()
        print(f"✗ Error executing {sql_file_path}: {e}")
        raise
    finally:
        cursor.close()


def main():
    """Main function to set up the database"""
    try:
        # Connect to database
        conn = get_db_connection()

        # Path to SQL files directory
        project_root = Path(__file__).parent.parent
        sql_dir = project_root / "code"

        # Execute SQL files in specific order
        # Order matters: schema first, then role-specific functions
        sql_files = [
            "schema.sql",  # Core tables, triggers, and auth functions
            "customer.sql",  # Customer-specific functions
            "supplier.sql",  # Supplier-specific functions
            "driver.sql",  # Driver-specific functions
        ]

        print(f"\nExecuting {len(sql_files)} SQL files...")

        for sql_filename in sql_files:
            sql_file = sql_dir / sql_filename
            if sql_file.exists():
                execute_sql_file(conn, sql_file)
            else:
                print(f"✗ SQL file not found: {sql_file}")
                raise FileNotFoundError(f"Required SQL file missing: {sql_filename}")

        # Close connection
        conn.close()
        print("\n✓ Database setup completed successfully!")

    except Exception as e:
        print(f"\n✗ Error: {e}")
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
