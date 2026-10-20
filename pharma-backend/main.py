import os
import joblib
import bcrypt
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

app = FastAPI(
    title="Smart Medicine Forecasting API - Pharmacie Unique",
    description="API de gestion de stock, prévision, administration d'utilisateurs et gestion de médicaments",
    version="1.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://smart-medicine-forecastin.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("INTERNAL_DATABASE_URL")

def get_db_connection():
    try:
        if DATABASE_URL:
            db_url = DATABASE_URL.replace("postgres://", "postgresql://", 1) if DATABASE_URL.startswith("postgres://") else DATABASE_URL
            conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
        else:
            conn = psycopg2.connect(
                dbname="pharma_predict",
                user="postgres",
                password="henintso56",
                host="localhost",
                port="5432",
                cursor_factory=RealDictCursor
            )
        return conn
    except Exception as e:
        print(f"\n❌ ERREUR CONNEXION POSTGRESQL : {e}\n")
        return None

# Utilitaires Bcrypt
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# Modèles Pydantic
class LoginInput(BaseModel):
    username: str
    password: str

class UserCreateInput(BaseModel):
    username: str
    password: str
    role: str = "admin_pharmacie"

class MedicamentCreateInput(BaseModel):
    nom: str
    quantite_initiale: int = 0
    seuil_alerte: int = 15

class SeuilUpdateInput(BaseModel):
    medicament_id: int
    seuil_alerte: int

class StockUpdate(BaseModel):
    medicament_id: int
    quantite_ajoutee: int

class PredictionInput(BaseModel):
    medicament_id: int
    mois: int

def init_db():
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS utilisateurs (
                        id SERIAL PRIMARY KEY,
                        username VARCHAR(50) UNIQUE NOT NULL,
                        password_hash VARCHAR(255) NOT NULL,
                        role VARCHAR(20) NOT NULL DEFAULT 'admin_pharmacie'
                    );

                    CREATE TABLE IF NOT EXISTS medicaments (
                        id SERIAL PRIMARY KEY,
                        nom VARCHAR(100) NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS stocks (
                        id SERIAL PRIMARY KEY,
                        medicament_id INT NOT NULL UNIQUE,
                        quantite_disponible INT DEFAULT 0,
                        seuil_alerte INT DEFAULT 15,
                        FOREIGN KEY (medicament_id) REFERENCES medicaments(id) ON DELETE CASCADE
                    );

                    CREATE TABLE IF NOT EXISTS mouvements_stock (
                        id SERIAL PRIMARY KEY,
                        medicament_id INT NOT NULL,
                        type_mouvement VARCHAR(10) NOT NULL,
                        quantite INT NOT NULL,
                        date_mouvement TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                conn.commit()

                # Upsert SuperAdmin
                hashed_superadmin = hash_password("superadmin123")
                cur.execute("""
                    INSERT INTO utilisateurs (username, password_hash, role)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;
                """, ("superadmin", hashed_superadmin, "superadmin"))

                # Upsert Pharmacie
                hashed_pharmacie = hash_password("pharma123")
                cur.execute("""
                    INSERT INTO utilisateurs (username, password_hash, role)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;
                """, ("pharmacie", hashed_pharmacie, "admin_pharmacie"))

                # Données médicaments
                cur.execute("SELECT COUNT(*) AS count FROM medicaments;")
                if cur.fetchone()['count'] == 0:
                    cur.execute("""
                        INSERT INTO medicaments (nom) VALUES 
                        ('Paracétamol 500mg'), 
                        ('Amoxicilline 1g'), 
                        ('Ibuprofène 400mg');
                    """)

                # Stocks
                cur.execute("SELECT COUNT(*) AS count FROM stocks;")
                if cur.fetchone()['count'] == 0:
                    cur.execute("""
                        INSERT INTO stocks (medicament_id, quantite_disponible, seuil_alerte) VALUES 
                        (1, 50, 15),
                        (2, 10, 15),
                        (3, 120, 20);
                    """)

                conn.commit()
            conn.close()
            print("✅ Base de données initialisée avec succès !")
        except Exception as e:
            print(f"❌ Erreur init DB : {e}")

init_db()

MODEL_PATH = "modele_pharma.joblib"
model = joblib.load(MODEL_PATH) if os.path.exists(MODEL_PATH) else None

@app.get("/")
def read_root():
    return {"message": "API Smart Medicine Forecasting opérationnelle"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

# LOGIN
@app.post("/login")
def login(credentials: LoginInput):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur de connexion BDD")
    try:
        username_clean = credentials.username.strip().lower()
        password_clean = credentials.password.strip()

        with conn.cursor() as cur:
            cur.execute("SELECT * FROM utilisateurs WHERE LOWER(username) = %s;", (username_clean,))
            user = cur.fetchone()
        conn.close()

        if not user or not verify_password(password_clean, user['password_hash']):
            raise HTTPException(status_code=401, detail="Identifiants incorrects")

        return {
            "message": "Connexion réussie",
            "username": user['username'],
            "role": user['role']
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# GESTION DES UTILISATEURS
@app.get("/utilisateurs")
def get_utilisateurs():
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur BDD")
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, username, role FROM utilisateurs ORDER BY id ASC;")
            users = cur.fetchall()
        conn.close()
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/utilisateurs")
def create_utilisateur(user: UserCreateInput):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur BDD")
    try:
        username_clean = user.username.strip().lower()
        if not username_clean or not user.password.strip():
            raise HTTPException(status_code=400, detail="Nom d'utilisateur et mot de passe requis")

        hashed_pwd = hash_password(user.password.strip())

        with conn.cursor() as cur:
            cur.execute("SELECT id FROM utilisateurs WHERE LOWER(username) = %s;", (username_clean,))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Cet utilisateur existe déjà")

            cur.execute("""
                INSERT INTO utilisateurs (username, password_hash, role)
                VALUES (%s, %s, %s) RETURNING id, username, role;
            """, (username_clean, hashed_pwd, user.role))
            new_user = cur.fetchone()
            conn.commit()
        conn.close()
        return new_user
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/utilisateurs/{user_id}")
def delete_utilisateur(user_id: int):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur BDD")
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT username FROM utilisateurs WHERE id = %s;", (user_id,))
            target_user = cur.fetchone()
            
            if not target_user:
                raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
            if target_user['username'] == 'superadmin':
                raise HTTPException(status_code=400, detail="Impossible de supprimer le compte superadmin principal")

            cur.execute("DELETE FROM utilisateurs WHERE id = %s;", (user_id,))
            conn.commit()
        conn.close()
        return {"message": "Utilisateur supprimé avec succès"}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# GESTION DU CATALOGUE MÉDICAMENTS (NOUVEAU)
@app.get("/medicaments")
def get_medicaments():
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur BDD")
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, nom FROM medicaments ORDER BY id ASC;")
            res = cur.fetchall()
        conn.close()
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/medicaments")
def create_medicament(med: MedicamentCreateInput):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur BDD")
    try:
        nom_clean = med.nom.strip()
        if not nom_clean:
            raise HTTPException(status_code=400, detail="Le nom du médicament est obligatoire")

        with conn.cursor() as cur:
            cur.execute("INSERT INTO medicaments (nom) VALUES (%s) RETURNING id, nom;", (nom_clean,))
            new_med = cur.fetchone()
            
            cur.execute("""
                INSERT INTO stocks (medicament_id, quantite_disponible, seuil_alerte)
                VALUES (%s, %s, %s);
            """, (new_med['id'], max(0, med.quantite_initiale), max(1, med.seuil_alerte)))
            
            conn.commit()
        conn.close()
        return {"message": "Médicament créé avec succès", "medicament": new_med}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/medicaments/{med_id}")
def delete_medicament(med_id: int):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur BDD")
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM medicaments WHERE id = %s;", (med_id,))
            conn.commit()
        conn.close()
        return {"message": "Médicament supprimé avec succès"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/stocks/seuil")
def update_seuil_alerte(data: SeuilUpdateInput):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur BDD")
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE stocks
                SET seuil_alerte = %s
                WHERE medicament_id = %s;
            """, (max(1, data.seuil_alerte), data.medicament_id))
            conn.commit()
        conn.close()
        return {"message": "Seuil d'alerte mis à jour"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# PRÉVISION & STOCKS
@app.post("/predict")
def predict(data: PredictionInput):
    if not model:
        return {"quantite_prevue": 200}

    df_input = pd.DataFrame([{
        'medicament_id': data.medicament_id,
        'etablissement_id': 1,
        'mois': data.mois
    }])

    prediction = model.predict(df_input)[0]
    return {
        "medicament_id": data.medicament_id,
        "mois_cible": data.mois,
        "quantite_prevue": round(float(prediction))
    }

@app.get("/stocks")
def get_stocks():
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur BDD")
    try:
        with conn.cursor() as cur:
            query = """
                SELECT s.id, 
                       s.medicament_id,
                       COALESCE(m.nom, 'Médicament Inconnu') AS medicament, 
                       s.quantite_disponible, 
                       s.seuil_alerte,
                       (s.quantite_disponible <= s.seuil_alerte) AS alerte_rupture
                FROM stocks s
                LEFT JOIN medicaments m ON s.medicament_id = m.id
                ORDER BY s.id ASC;
            """
            cur.execute(query)
            res = cur.fetchall()
        conn.close()
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/stocks/mouvement")
def enregistrer_mouvement(data: StockUpdate):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur BDD")
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT quantite_disponible FROM stocks WHERE medicament_id = %s;", (data.medicament_id,))
            stock_existant = cur.fetchone()

            if stock_existant:
                cur.execute("""
                    UPDATE stocks 
                    SET quantite_disponible = GREATEST(0, quantite_disponible + %s)
                    WHERE medicament_id = %s;
                """, (data.quantite_ajoutee, data.medicament_id))
            else:
                nouvelle_qte = max(0, data.quantite_ajoutee)
                cur.execute("""
                    INSERT INTO stocks (medicament_id, quantite_disponible, seuil_alerte)
                    VALUES (%s, %s, 15);
                """, (data.medicament_id, nouvelle_qte))

            type_mouvement = "ENTREE" if data.quantite_ajoutee > 0 else "SORTIE"
            cur.execute("""
                INSERT INTO mouvements_stock (medicament_id, type_mouvement, quantite)
                VALUES (%s, %s, %s);
            """, (data.medicament_id, type_mouvement, abs(data.quantite_ajoutee)))

            conn.commit()
        conn.close()
        return {"message": "Mouvement enregistré avec succès"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/mouvements")
def get_mouvements():
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur BDD")
    try:
        with conn.cursor() as cur:
            query = """
                SELECT 
                    m.id,
                    COALESCE(med.nom, 'Médicament Inconnu') AS medicament,
                    m.type_mouvement,
                    m.quantite,
                    m.date_mouvement
                FROM mouvements_stock m
                LEFT JOIN medicaments med ON m.medicament_id = med.id
                ORDER BY m.date_mouvement DESC
                LIMIT 20;
            """
            cur.execute(query)
            res = cur.fetchall()
        conn.close()
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/mouvements")
def supprimer_historique():
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur BDD")
    try:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE TABLE mouvements_stock;")
            conn.commit()
        conn.close()
        return {"message": "Historique vidé avec succès"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))import os
import joblib
import bcrypt
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

app = FastAPI(
    title="Smart Medicine Forecasting API - Pharmacie Unique",
    description="API de gestion de stock, prévision et administration d'utilisateurs",
    version="1.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://smart-medicine-forecastin.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("INTERNAL_DATABASE_URL")

def get_db_connection():
    try:
        if DATABASE_URL:
            db_url = DATABASE_URL.replace("postgres://", "postgresql://", 1) if DATABASE_URL.startswith("postgres://") else DATABASE_URL
            conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
        else:
            conn = psycopg2.connect(
                dbname="pharma_predict",
                user="postgres",
                password="henintso56",
                host="localhost",
                port="5432",
                cursor_factory=RealDictCursor
            )
        return conn
    except Exception as e:
        print(f"\n❌ ERREUR CONNEXION POSTGRESQL : {e}\n")
        return None

# Utilitaires Bcrypt
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# Modèles Pydantic
class LoginInput(BaseModel):
    username: str
    password: str

class UserCreateInput(BaseModel):
    username: str
    password: str
    role: str = "admin_pharmacie"

class StockUpdate(BaseModel):
    medicament_id: int
    quantite_ajoutee: int

class PredictionInput(BaseModel):
    medicament_id: int
    mois: int

def init_db():
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS utilisateurs (
                        id SERIAL PRIMARY KEY,
                        username VARCHAR(50) UNIQUE NOT NULL,
                        password_hash VARCHAR(255) NOT NULL,
                        role VARCHAR(20) NOT NULL DEFAULT 'admin_pharmacie'
                    );

                    CREATE TABLE IF NOT EXISTS medicaments (
                        id SERIAL PRIMARY KEY,
                        nom VARCHAR(100) NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS stocks (
                        id SERIAL PRIMARY KEY,
                        medicament_id INT NOT NULL,
                        quantite_disponible INT DEFAULT 0,
                        seuil_alerte INT DEFAULT 15,
                        FOREIGN KEY (medicament_id) REFERENCES medicaments(id) ON DELETE CASCADE
                    );

                    CREATE TABLE IF NOT EXISTS mouvements_stock (
                        id SERIAL PRIMARY KEY,
                        medicament_id INT NOT NULL,
                        type_mouvement VARCHAR(10) NOT NULL,
                        quantite INT NOT NULL,
                        date_mouvement TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                conn.commit()

                # Upsert SuperAdmin
                hashed_superadmin = hash_password("superadmin123")
                cur.execute("""
                    INSERT INTO utilisateurs (username, password_hash, role)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;
                """, ("superadmin", hashed_superadmin, "superadmin"))

                # Upsert Pharmacie
                hashed_pharmacie = hash_password("pharma123")
                cur.execute("""
                    INSERT INTO utilisateurs (username, password_hash, role)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;
                """, ("pharmacie", hashed_pharmacie, "admin_pharmacie"))

                # Données médicaments
                cur.execute("SELECT COUNT(*) AS count FROM medicaments;")
                if cur.fetchone()['count'] == 0:
                    cur.execute("""
                        INSERT INTO medicaments (nom) VALUES 
                        ('Paracétamol 500mg'), 
                        ('Amoxicilline 1g'), 
                        ('Ibuprofène 400mg');
                    """)

                # Stocks
                cur.execute("SELECT COUNT(*) AS count FROM stocks;")
                if cur.fetchone()['count'] == 0:
                    cur.execute("""
                        INSERT INTO stocks (medicament_id, quantite_disponible, seuil_alerte) VALUES 
                        (1, 50, 15),
                        (2, 10, 15),
                        (3, 120, 20);
                    """)

                conn.commit()
            conn.close()
            print("✅ Base de données initialisée avec succès !")
        except Exception as e:
            print(f"❌ Erreur init DB : {e}")

init_db()

MODEL_PATH = "modele_pharma.joblib"
model = joblib.load(MODEL_PATH) if os.path.exists(MODEL_PATH) else None

@app.get("/")
def read_root():
    return {"message": "API Smart Medicine Forecasting opérationnelle"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

# LOGIN
@app.post("/login")
def login(credentials: LoginInput):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur de connexion BDD")
    try:
        username_clean = credentials.username.strip().lower()
        password_clean = credentials.password.strip()

        with conn.cursor() as cur:
            cur.execute("SELECT * FROM utilisateurs WHERE LOWER(username) = %s;", (username_clean,))
            user = cur.fetchone()
        conn.close()

        if not user or not verify_password(password_clean, user['password_hash']):
            raise HTTPException(status_code=401, detail="Identifiants incorrects")

        return {
            "message": "Connexion réussie",
            "username": user['username'],
            "role": user['role']
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# GESTION DES UTILISATEURS (SUPERADMIN)
@app.get("/utilisateurs")
def get_utilisateurs():
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur BDD")
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, username, role FROM utilisateurs ORDER BY id ASC;")
            users = cur.fetchall()
        conn.close()
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/utilisateurs")
def create_utilisateur(user: UserCreateInput):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur BDD")
    try:
        username_clean = user.username.strip().lower()
        if not username_clean or not user.password.strip():
            raise HTTPException(status_code=400, detail="Nom d'utilisateur et mot de passe requis")

        hashed_pwd = hash_password(user.password.strip())

        with conn.cursor() as cur:
            cur.execute("SELECT id FROM utilisateurs WHERE LOWER(username) = %s;", (username_clean,))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Cet utilisateur existe déjà")

            cur.execute("""
                INSERT INTO utilisateurs (username, password_hash, role)
                VALUES (%s, %s, %s) RETURNING id, username, role;
            """, (username_clean, hashed_pwd, user.role))
            new_user = cur.fetchone()
            conn.commit()
        conn.close()
        return new_user
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/utilisateurs/{user_id}")
def delete_utilisateur(user_id: int):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur BDD")
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT username FROM utilisateurs WHERE id = %s;", (user_id,))
            target_user = cur.fetchone()
            
            if not target_user:
                raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
            if target_user['username'] == 'superadmin':
                raise HTTPException(status_code=400, detail="Impossible de supprimer le compte superadmin principal")

            cur.execute("DELETE FROM utilisateurs WHERE id = %s;", (user_id,))
            conn.commit()
        conn.close()
        return {"message": "Utilisateur supprimé avec succès"}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# STOCKS & MÉDICAMENTS
@app.get("/medicaments")
def get_medicaments():
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur BDD")
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, nom FROM medicaments ORDER BY id ASC;")
            res = cur.fetchall()
        conn.close()
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict")
def predict(data: PredictionInput):
    if not model:
        return {"quantite_prevue": 200}

    df_input = pd.DataFrame([{
        'medicament_id': data.medicament_id,
        'etablissement_id': 1,
        'mois': data.mois
    }])

    prediction = model.predict(df_input)[0]
    return {
        "medicament_id": data.medicament_id,
        "mois_cible": data.mois,
        "quantite_prevue": round(float(prediction))
    }

@app.get("/stocks")
def get_stocks():
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur BDD")
    try:
        with conn.cursor() as cur:
            query = """
                SELECT s.id, 
                       COALESCE(m.nom, 'Médicament Inconnu') AS medicament, 
                       s.quantite_disponible, 
                       s.seuil_alerte,
                       (s.quantite_disponible <= s.seuil_alerte) AS alerte_rupture
                FROM stocks s
                LEFT JOIN medicaments m ON s.medicament_id = m.id
                ORDER BY s.id ASC;
            """
            cur.execute(query)
            res = cur.fetchall()
        conn.close()
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/stocks/mouvement")
def enregistrer_mouvement(data: StockUpdate):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur BDD")
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT quantite_disponible FROM stocks WHERE medicament_id = %s;", (data.medicament_id,))
            stock_existant = cur.fetchone()

            if stock_existant:
                cur.execute("""
                    UPDATE stocks 
                    SET quantite_disponible = GREATEST(0, quantite_disponible + %s)
                    WHERE medicament_id = %s;
                """, (data.quantite_ajoutee, data.medicament_id))
            else:
                nouvelle_qte = max(0, data.quantite_ajoutee)
                cur.execute("""
                    INSERT INTO stocks (medicament_id, quantite_disponible, seuil_alerte)
                    VALUES (%s, %s, 15);
                """, (data.medicament_id, nouvelle_qte))

            type_mouvement = "ENTREE" if data.quantite_ajoutee > 0 else "SORTIE"
            cur.execute("""
                INSERT INTO mouvements_stock (medicament_id, type_mouvement, quantite)
                VALUES (%s, %s, %s);
            """, (data.medicament_id, type_mouvement, abs(data.quantite_ajoutee)))

            conn.commit()
        conn.close()
        return {"message": "Mouvement enregistré avec succès"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/mouvements")
def get_mouvements():
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur BDD")
    try:
        with conn.cursor() as cur:
            query = """
                SELECT 
                    m.id,
                    COALESCE(med.nom, 'Médicament Inconnu') AS medicament,
                    m.type_mouvement,
                    m.quantite,
                    m.date_mouvement
                FROM mouvements_stock m
                LEFT JOIN medicaments med ON m.medicament_id = med.id
                ORDER BY m.date_mouvement DESC
                LIMIT 20;
            """
            cur.execute(query)
            res = cur.fetchall()
        conn.close()
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/mouvements")
def supprimer_historique():
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur BDD")
    try:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE TABLE mouvements_stock;")
            conn.commit()
        conn.close()
        return {"message": "Historique vidé avec succès"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
