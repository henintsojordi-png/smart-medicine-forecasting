import os
import joblib
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from passlib.context import CryptContext

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

# Configuration du hachage de mot de passe avec Bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(
    title="Smart Medicine Forecasting API - Pharmacie Unique",
    description="API de gestion de stock et de prévision pour pharmacie",
    version="1.0.0"
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

# Modèles Pydantic
class LoginInput(BaseModel):
    username: str
    password: str

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
                # Création des tables
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

                # Insérer / Vérifier le compte SuperAdmin
                cur.execute("SELECT * FROM utilisateurs WHERE username = 'superadmin';")
                if not cur.fetchone():
                    hashed_superadmin = pwd_context.hash("superadmin123")
                    cur.execute(
                        "INSERT INTO utilisateurs (username, password_hash, role) VALUES (%s, %s, %s);",
                        ("superadmin", hashed_superadmin, "superadmin")
                    )

                # Insérer / Vérifier le compte Pharmacie
                cur.execute("SELECT * FROM utilisateurs WHERE username = 'pharmacie';")
                if not cur.fetchone():
                    hashed_pharmacie = pwd_context.hash("pharma123")
                    cur.execute(
                        "INSERT INTO utilisateurs (username, password_hash, role) VALUES (%s, %s, %s);",
                        ("pharmacie", hashed_pharmacie, "admin_pharmacie")
                    )

                # Données médicaments par défaut
                cur.execute("SELECT COUNT(*) AS count FROM medicaments;")
                if cur.fetchone()['count'] == 0:
                    cur.execute("""
                        INSERT INTO medicaments (nom) VALUES 
                        ('Paracétamol 500mg'), 
                        ('Amoxicilline 1g'), 
                        ('Ibuprofène 400mg');
                    """)

                # Stocks par défaut
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

# ROUTE LOGIN SÉCURISÉE WITH BCRYPT
@app.post("/login")
def login(credentials: LoginInput):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur de connexion BDD")
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM utilisateurs WHERE username = %s;", (credentials.username,))
            user = cur.fetchone()
        conn.close()

        if not user or not pwd_context.verify(credentials.password, user['password_hash']):
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
