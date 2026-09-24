import os
import joblib
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="Smart Medicine Forecasting API",
    description="API de prévision et de gestion de stock de médicaments",
    version="1.0.0"
)

# Configuration CORS pour autoriser Vercel, le dev local et tous les clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connexion dynamique : Récupère la variable d'environnement de Render si disponible, sinon prend le local
DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("INTERNAL_DATABASE_URL")

def get_db_connection():
    try:
        if DATABASE_URL:
            # Connexion pour la base PostgreSQL Render
            conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        else:
            # Fallback pour le développement local
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

# Initialisation automatique de la table d'historique
def init_db():
    conn = get_db_connection()
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS mouvements_stock (
                        id SERIAL PRIMARY KEY,
                        medicament_id INT NOT NULL,
                        etablissement_id INT NOT NULL,
                        type_mouvement VARCHAR(10) NOT NULL,
                        quantite INT NOT NULL,
                        date_mouvement TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                conn.commit()
            conn.close()
        except Exception as e:
            print(f"Erreur init DB : {e}")

init_db()

MODEL_PATH = "modele_pharma.joblib"
model = joblib.load(MODEL_PATH) if os.path.exists(MODEL_PATH) else None

class PredictionInput(BaseModel):
    medicament_id: int
    etablissement_id: int
    mois: int

class StockUpdate(BaseModel):
    medicament_id: int
    etablissement_id: int
    quantite_ajoutee: int


@app.get("/")
def read_root():
    return {"message": "API Smart Medicine Forecasting opérationnelle"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/medicaments")
def get_medicaments():
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur de connexion à la base de données")
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, nom FROM medicaments ORDER BY id ASC;")
            res = cur.fetchall()
        conn.close()
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/etablissements")
def get_etablissements():
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur de connexion à la base de données")
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, nom FROM etablissements ORDER BY id ASC;")
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
        'etablissement_id': data.etablissement_id,
        'mois': data.mois
    }])

    prediction = model.predict(df_input)[0]
    return {
        "medicament_id": data.medicament_id,
        "etablissement_id": data.etablissement_id,
        "mois_cible": data.mois,
        "quantite_prevue": round(float(prediction))
    }


@app.get("/stocks")
def get_stocks():
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur de connexion à la base de données")
    try:
        with conn.cursor() as cur:
            query = """
                SELECT s.id, 
                       COALESCE(m.nom, 'Médicament Inconnu') AS medicament, 
                       COALESCE(e.nom, 'Établissement Inconnu') AS etablissement, 
                       s.quantite_disponible, 
                       s.seuil_alerte,
                       (s.quantite_disponible <= s.seuil_alerte) AS alerte_rupture
                FROM stocks s
                LEFT JOIN medicaments m ON s.medicament_id = m.id
                LEFT JOIN etablissements e ON s.etablissement_id = e.id
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
        raise HTTPException(status_code=500, detail="Erreur de connexion à la base de données")
    
    try:
        with conn.cursor() as cur:
            # 1. Vérifier si le stock existe déjà pour cet établissement et médicament
            cur.execute("""
                SELECT quantite_disponible FROM stocks 
                WHERE medicament_id = %s AND etablissement_id = %s;
            """, (data.medicament_id, data.etablissement_id))
            stock_existant = cur.fetchone()

            if stock_existant:
                # Si le stock existe, on additionne ou soustrait (sans descendre en dessous de 0)
                cur.execute("""
                    UPDATE stocks 
                    SET quantite_disponible = GREATEST(0, quantite_disponible + %s)
                    WHERE medicament_id = %s AND etablissement_id = %s;
                """, (data.quantite_ajoutee, data.medicament_id, data.etablissement_id))
            else:
                # Si le stock n'existe pas encore et qu'on fait un ajout (+)
                nouvelle_qte = max(0, data.quantite_ajoutee)
                cur.execute("""
                    INSERT INTO stocks (medicament_id, etablissement_id, quantite_disponible, seuil_alerte)
                    VALUES (%s, %s, %s, 15);
                """, (data.medicament_id, data.etablissement_id, nouvelle_qte))

            # 2. Enregistrement dans l'historique
            type_mouvement = "ENTREE" if data.quantite_ajoutee > 0 else "SORTIE"
            quantite_abs = abs(data.quantite_ajoutee)
            
            cur.execute("""
                INSERT INTO mouvements_stock (medicament_id, etablissement_id, type_mouvement, quantite)
                VALUES (%s, %s, %s, %s);
            """, (data.medicament_id, data.etablissement_id, type_mouvement, quantite_abs))

            conn.commit()
        conn.close()
        return {"message": "Mouvement enregistré avec succès"}
    except Exception as e:
        print(f"\n❌ ERREUR MOUVEMENT : {e}\n")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/mouvements")
def get_mouvements():
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Erreur de connexion à la base de données")
    try:
        with conn.cursor() as cur:
            query = """
                SELECT 
                    m.id,
                    COALESCE(med.nom, 'Médicament Inconnu') AS medicament,
                    COALESCE(e.nom, 'Établissement Inconnu') AS etablissement,
                    m.type_mouvement,
                    m.quantite,
                    m.date_mouvement
                FROM mouvements_stock m
                LEFT JOIN medicaments med ON m.medicament_id = med.id
                LEFT JOIN etablissements e ON m.etablissement_id = e.id
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
        raise HTTPException(status_code=500, detail="Erreur de connexion à la base de données")
    try:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE TABLE mouvements_stock;")
            conn.commit()
        conn.close()
        return {"message": "Historique vidé avec succès"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
