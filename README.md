# Tanker Delivery System

## Setup Instructions

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Database Connection

1. Open the `.env` file in the root directory
2. Replace the placeholder with your Supabase connection string:
   ```
   DATABASE_URL=your_actual_connection_string_here
   ```

### 3. Initialize Database Schema

Run the setup script to create all tables, functions, and triggers:

```bash
python code/db_setup.py
```

## Project Structure

- `code/` - Application code and scripts
- `documents/` - SQL schema files and documentation
- `.env` - Database connection configuration (DO NOT commit to git)
